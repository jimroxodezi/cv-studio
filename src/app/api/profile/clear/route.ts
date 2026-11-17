import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { assertSameOrigin, error, handleError, json, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { profiles, variants } from "@/lib/db/schema";
import { emptyProfile } from "@/lib/profile";
import { getProfileRow } from "@/lib/guards";
import { hasContent, snapshotProfile } from "@/lib/snapshots";

export const dynamic = "force-dynamic";

const clearSchema = z.object({
  /** Typed by the user. Guards against an accidental wipe. */
  confirm: z.string().max(40).default(""),
});

/**
 * Wipe the career memory back to an empty profile, keeping the account and the
 * name already on it. Variants survive but are re-pointed at the empty sections,
 * so no variant can build against section or entry ids that no longer exist.
 */
export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    const body = await readJson(request, clearSchema);

    if (body.confirm.trim().toUpperCase() !== "CLEAR") {
      return error('Type "CLEAR" to confirm you want to erase the career memory.', 400);
    }

    // Keep a copy first, so "clear" is recoverable from History.
    const current = await getProfileRow(user.id);
    if (current && hasContent(current.data, current.rawDump)) {
      await snapshotProfile({
        userId: user.id,
        data: current.data,
        rawDump: current.rawDump,
        reason: "clear",
        label: "Before clearing",
      });
    }

    const data = emptyProfile(user.email, user.name);
    const db = getDb();

    await db
      .insert(profiles)
      .values({ userId: user.id, data, rawDump: "" })
      .onConflictDoUpdate({
        target: profiles.userId,
        set: { data, rawDump: "", updatedAt: new Date() },
      });

    // Keep variants, but empty their selections until a new dump is imported.
    await db
      .update(variants)
      .set({
        sectionIds: data.sections.map((section) => section.id),
        entryIds: [],
        updatedAt: new Date(),
      })
      .where(eq(variants.userId, user.id));

    return json({ ok: true, sections: data.sections.length });
  } catch (err) {
    return handleError(err);
  }
}
