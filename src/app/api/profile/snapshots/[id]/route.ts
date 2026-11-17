import type { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { error, handleError, json } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { profileSnapshots } from "@/lib/db/schema";
import { profileCounts } from "@/lib/snapshots";
import { normalizeProfileData } from "@/lib/profile";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const rows = await getDb()
      .select()
      .from(profileSnapshots)
      .where(and(eq(profileSnapshots.id, id), eq(profileSnapshots.userId, user.id)))
      .limit(1);
    const snapshot = rows[0];
    if (!snapshot) return error("That snapshot could not be found.", 404);

    const data = normalizeProfileData(snapshot.data);
    return json({
      snapshot: {
        id: snapshot.id,
        label: snapshot.label,
        reason: snapshot.reason,
        createdAt: snapshot.createdAt,
        counts: profileCounts(data),
        data,
        rawDump: snapshot.rawDump,
      },
    });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const deleted = await getDb()
      .delete(profileSnapshots)
      .where(and(eq(profileSnapshots.id, id), eq(profileSnapshots.userId, user.id)))
      .returning({ id: profileSnapshots.id });

    if (!deleted.length) return error("That snapshot could not be found.", 404);
    return json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
