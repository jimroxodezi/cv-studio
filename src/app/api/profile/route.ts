import type { NextRequest } from "next/server";
import { z } from "zod";
import { assertSameOrigin, handleError, json, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { profiles, users } from "@/lib/db/schema";
import { profileDataSchema } from "@/lib/profile";
import { ensureProfile, getProfileRow } from "@/lib/guards";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

const putSchema = z.object({
  data: profileDataSchema,
  rawDump: z.string().max(200_000).optional(),
});

export async function GET() {
  try {
    const user = await requireUser();
    await ensureProfile(user);
    const row = await getProfileRow(user.id);
    return json({ profile: row?.data ?? null, rawDump: row?.rawDump ?? "" });
  } catch (err) {
    return handleError(err);
  }
}

export async function PUT(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    const { data, rawDump } = await readJson(request, putSchema);
    const db = getDb();
    await db
      .insert(profiles)
      .values({ userId: user.id, data, rawDump: rawDump ?? "" })
      .onConflictDoUpdate({
        target: profiles.userId,
        set: { data, rawDump: rawDump ?? "", updatedAt: new Date() },
      });
    if (data.identity.fullName && data.identity.fullName !== user.name) {
      await db.update(users).set({ name: data.identity.fullName }).where(eq(users.id, user.id));
    }
    return json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
