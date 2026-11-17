import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { users, type UserRow } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { isHttpsRequest } from "@/lib/base-url";

const COOKIE_NAME = "cv_session";
const MAX_AGE = 60 * 60 * 24 * 30;

function encode(value: unknown): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function sign(data: string): string {
  return createHmac("sha256", env.authSecret).update(data).digest("base64url");
}

/**
 * Minimal HS256 JWT. The bundled `jose` copy in the production build rejected
 * URL-safe signatures that contain "-" or "_", so signing is done directly with
 * node:crypto instead. Same token shape, no runtime dependency.
 */
function createToken(userId: string): string {
  const now = Math.floor(Date.now() / 1000);
  const header = encode({ alg: "HS256", typ: "JWT" });
  const payload = encode({ sub: userId, iat: now, exp: now + MAX_AGE });
  const data = `${header}.${payload}`;
  return `${data}.${sign(data)}`;
}

function readToken(token: string): { sub: string } | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts;
  if (!header || !payload || !signature) return null;

  const expected = sign(`${header}.${payload}`);
  const given = Buffer.from(signature, "utf8");
  const wanted = Buffer.from(expected, "utf8");
  if (given.length !== wanted.length || !timingSafeEqual(given, wanted)) return null;

  try {
    const head = JSON.parse(Buffer.from(header, "base64url").toString("utf8")) as {
      alg?: unknown;
    };
    if (head.alg !== "HS256") return null;

    const body = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      sub?: unknown;
      exp?: unknown;
    };
    if (typeof body.sub !== "string" || !body.sub) return null;
    if (typeof body.exp === "number" && body.exp * 1000 <= Date.now()) return null;
    return { sub: body.sub };
  } catch {
    return null;
  }
}

export async function createSession(userId: string): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, createToken(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: await isHttpsRequest(),
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function getSessionUser(): Promise<UserRow | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const session = readToken(token);
  if (!session) return null;
  try {
    const db = getDb();
    const rows = await db.select().from(users).where(eq(users.id, session.sub)).limit(1);
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

export async function requireUser(): Promise<UserRow> {
  const user = await getSessionUser();
  if (!user) throw new Error("UNAUTHORIZED");
  return user;
}

export async function requireAdmin(): Promise<UserRow> {
  const user = await requireUser();
  if (user.role !== "admin") throw new Error("FORBIDDEN");
  return user;
}

export async function findUserByEmail(email: string): Promise<UserRow | null> {
  const rows = await getDb()
    .select()
    .from(users)
    .where(sql`lower(${users.email}) = ${email.toLowerCase()}`)
    .limit(1);
  return rows[0] ?? null;
}
