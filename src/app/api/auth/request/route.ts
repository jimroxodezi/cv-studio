import type { NextRequest } from "next/server";
import { z } from "zod";
import { assertSameOrigin, error, json, handleError, readJson } from "@/lib/api";
import { createAuthToken, ensureBootstrapAdmin, hasPendingInvite, recentTokenCount } from "@/lib/auth-tokens";
import { findUserByEmail } from "@/lib/auth";
import { sendInvite, sendLoginLink } from "@/lib/email";
import { publicOrigin } from "@/lib/base-url";
import { env } from "@/lib/env";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";

const schema = z.object({ email: z.string().trim().email().max(200) });

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const { email } = await readJson(request, schema);
    const normalized = email.toLowerCase();

    if ((await recentTokenCount(normalized)) >= 4) {
      return json({ ok: true, delivered: false, message: "If that address can sign in, a link is on its way." });
    }

    await ensureBootstrapAdmin(normalized);
    const user = await findUserByEmail(normalized);
    const base = await publicOrigin();

    let delivered = false;
    let devUrl: string | undefined;

    if (user) {
      const token = await createAuthToken(normalized, "login", 20);
      const url = `${base}/auth/verify?token=${encodeURIComponent(token)}`;
      const result = await sendLoginLink(normalized, url);
      delivered = result.delivered;
      if (!result.delivered && process.env.NODE_ENV !== "production") devUrl = url;
    } else if (await hasPendingInvite(normalized)) {
      const token = await createAuthToken(normalized, "invite", 7 * 24 * 60);
      const url = `${base}/auth/verify?token=${encodeURIComponent(token)}`;
      const result = await sendInvite(normalized, url, "CV Studio");
      delivered = result.delivered;
      if (!result.delivered && process.env.NODE_ENV !== "production") devUrl = url;
    } else if (env.allowOpenSignup) {
      await getDb().insert(users).values({ email: normalized, name: "", role: "member" }).onConflictDoNothing();
      const token = await createAuthToken(normalized, "login", 20);
      const url = `${base}/auth/verify?token=${encodeURIComponent(token)}`;
      const result = await sendLoginLink(normalized, url);
      delivered = result.delivered;
      if (!result.delivered && process.env.NODE_ENV !== "production") devUrl = url;
    }

    return json({
      ok: true,
      delivered,
      devUrl,
      message: "If that address can sign in, a link is on its way.",
    });
  } catch (err) {
    if (err instanceof Error && err.message.includes("Invalid request")) return error(err.message, 400);
    return handleError(err);
  }
}
