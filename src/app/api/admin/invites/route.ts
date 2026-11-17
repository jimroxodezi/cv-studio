import type { NextRequest } from "next/server";
import { desc } from "drizzle-orm";
import { z } from "zod";
import { assertSameOrigin, handleError, json, readJson } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { createInvite } from "@/lib/auth-tokens";
import { sendInvite } from "@/lib/email";
import { publicOrigin } from "@/lib/base-url";
import { getDb } from "@/lib/db";
import { invites, users } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

const schema = z.object({ email: z.string().trim().email().max(200) });

export async function GET() {
  try {
    await requireAdmin();
    const db = getDb();
    const memberRows = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(desc(users.createdAt));
    const inviteRows = await db.select().from(invites).orderBy(desc(invites.createdAt)).limit(50);
    return json({ users: memberRows, invites: inviteRows });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const admin = await requireAdmin();
    const { email } = await readJson(request, schema);
    const token = await createInvite(email, admin.id);
    const url = `${await publicOrigin()}/auth/verify?token=${encodeURIComponent(token)}`;
    const result = await sendInvite(email, url, admin.name || admin.email);
    // Without SMTP nothing is delivered, so hand the link to the admin. Only
    // admins reach this route, and the link still only works for this address.
    return json({
      ok: true,
      delivered: result.delivered,
      inviteUrl: result.delivered ? undefined : url,
    });
  } catch (err) {
    return handleError(err);
  }
}
