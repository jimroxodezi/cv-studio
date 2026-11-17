import type { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { assertSameOrigin, error, handleError, json } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { profileSnapshots, profiles, users } from "@/lib/db/schema";
import { getProfileRow } from "@/lib/guards";
import {
  hasContent,
  profileCounts,
  repointVariants,
  snapshotProfile,
} from "@/lib/snapshots";
import { normalizeProfileData } from "@/lib/profile";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * Put an old snapshot back. The state being replaced is snapshotted first, so a
 * restore is itself reversible and never loses the memory that was live.
 */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    const { id } = await params;

    const rows = await getDb()
      .select()
      .from(profileSnapshots)
      .where(and(eq(profileSnapshots.id, id), eq(profileSnapshots.userId, user.id)))
      .limit(1);
    const snapshot = rows[0];
    if (!snapshot) return error("That snapshot could not be found.", 404);

    const current = await getProfileRow(user.id);
    if (current && hasContent(current.data, current.rawDump)) {
      await snapshotProfile({
        userId: user.id,
        data: current.data,
        rawDump: current.rawDump,
        reason: "restore",
        label: "Before restore",
      });
    }

    const data = normalizeProfileData(snapshot.data);
    const db = getDb();

    await db
      .insert(profiles)
      .values({ userId: user.id, data, rawDump: snapshot.rawDump })
      .onConflictDoUpdate({
        target: profiles.userId,
        set: { data, rawDump: snapshot.rawDump, updatedAt: new Date() },
      });

    if (data.identity.fullName && data.identity.fullName !== user.name) {
      await db.update(users).set({ name: data.identity.fullName }).where(eq(users.id, user.id));
    }

    const repointed = await repointVariants(user.id, data);

    return json({
      ok: true,
      counts: profileCounts(data),
      repointedVariants: repointed,
    });
  } catch (err) {
    return handleError(err);
  }
}
