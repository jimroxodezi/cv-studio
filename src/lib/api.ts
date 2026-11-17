import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import type { ZodType } from "zod";
import { env } from "@/lib/env";

export function json(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

export function error(message: string, status = 400): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

export class UserError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "UserError";
    this.status = status;
  }
}

export function handleError(err: unknown): NextResponse {
  const message = err instanceof Error ? err.message : "Unexpected error";
  if (err instanceof UserError) return error(err.message, err.status);
  if (message === "UNAUTHORIZED") return error("Sign in to continue.", 401);
  if (message === "FORBIDDEN") return error("You do not have access to this.", 403);
  if (message === "NOT_FOUND") return error("That item could not be found.", 404);
  console.error(err);
  return error(message, 500);
}

export async function readJson<T>(request: NextRequest, schema: ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new UserError("Request body must be valid JSON.");
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new UserError(
      `Invalid request: ${issue?.path.join(".") || "body"} ${issue?.message || ""}`.trim(),
    );
  }
  return parsed.data;
}

export function assertSameOrigin(request: NextRequest): void {
  const origin = request.headers.get("origin");
  if (!origin) return;
  const allowed = new Set<string>();
  try {
    allowed.add(new URL(env.appUrl).origin);
  } catch {
    /* ignore */
  }
  const host = request.headers.get("host");
  if (host) {
    allowed.add(`http://${host}`);
    allowed.add(`https://${host}`);
  }
  if (!allowed.has(origin)) throw new Error("Cross-origin request rejected.");
}

export function text(value: unknown, max = 5000): string {
  return typeof value === "string" ? value.slice(0, max) : "";
}
