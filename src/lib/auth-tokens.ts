import "server-only";
import { and, eq, gte, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { authTokens, invites, users } from "@/lib/db/schema";
import { randomToken, sha256 } from "@/lib/crypto";
import { env } from "@/lib/env";

export async function createAuthToken(
  email: string,
  purpose: "login" | "invite",
  ttlMinutes: number,
): Promise<string> {
  const raw = randomToken();
  await getDb().insert(authTokens).values({
    email: email.toLowerCase(),
    tokenHash: sha256(raw),
    purpose,
    expiresAt: new Date(Date.now() + ttlMinutes * 60 * 1000),
  });
  return raw;
}

export async function consumeAuthToken(
  raw: string,
  purpose: "login" | "invite",
): Promise<string | null> {
  if (!raw) return null;
  const db = getDb();
  const rows = await db
    .select()
    .from(authTokens)
    .where(and(eq(authTokens.tokenHash, sha256(raw)), eq(authTokens.purpose, purpose)))
    .limit(1);
  const token = rows[0];
  if (!token) return null;
  if (token.usedAt || token.expiresAt.getTime() < Date.now()) return null;
  await db.update(authTokens).set({ usedAt: new Date() }).where(eq(authTokens.id, token.id));
  return token.email;
}

export async function countUsers(): Promise<number> {
  const rows = await getDb().select({ total: sql<number>`count(*)::int` }).from(users);
  return Number(rows[0]?.total ?? 0);
}

export async function ensureBootstrapAdmin(email: string): Promise<boolean> {
  const usersCount = await countUsers();
  if (usersCount > 0) return false;
  if (!env.adminEmail || email.toLowerCase() !== env.adminEmail) return false;
  await getDb()
    .insert(users)
    .values({ email: email.toLowerCase(), name: "Admin", role: "admin" })
    .onConflictDoNothing();
  return true;
}

export async function createInvite(email: string, invitedBy: string): Promise<string> {
  const db = getDb();
  await db.insert(invites).values({
    email: email.toLowerCase(),
    invitedBy,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });
  return createAuthToken(email, "invite", 7 * 24 * 60);
}

export async function acceptInvite(raw: string): Promise<{ email: string; role: string } | null> {
  const email = await consumeAuthToken(raw, "invite");
  if (!email) return null;
  const db = getDb();
  const existing = await db
    .select()
    .from(users)
    .where(sql`lower(${users.email}) = ${email.toLowerCase()}`)
    .limit(1);
  if (!existing.length) {
    await db
      .insert(users)
      .values({ email: email.toLowerCase(), name: "", role: "member" })
      .onConflictDoNothing();
  }
  await db
    .update(invites)
    .set({ acceptedAt: new Date() })
    .where(sql`lower(${invites.email}) = ${email.toLowerCase()} and ${invites.acceptedAt} is null`);
  const rows = await db
    .select()
    .from(users)
    .where(sql`lower(${users.email}) = ${email.toLowerCase()}`)
    .limit(1);
  if (!rows.length) return null;
  return { email: rows[0].email, role: rows[0].role };
}

export async function hasPendingInvite(email: string): Promise<boolean> {
  const rows = await getDb()
    .select({ id: invites.id })
    .from(invites)
    .where(
      and(
        sql`lower(${invites.email}) = ${email.toLowerCase()}`,
        sql`${invites.acceptedAt} is null`,
        sql`${invites.expiresAt} > now()`,
      ),
    )
    .limit(1);
  return rows.length > 0;
}

export async function recentTokenCount(email: string, minutes = 15): Promise<number> {
  const since = new Date(Date.now() - minutes * 60 * 1000);
  const rows = await getDb()
    .select({ total: sql<number>`count(*)::int` })
    .from(authTokens)
    .where(
      and(
        sql`lower(${authTokens.email}) = ${email.toLowerCase()}`,
        gte(authTokens.createdAt, since),
      ),
    );
  return Number(rows[0]?.total ?? 0);
}
