import "server-only";
import { and, desc, eq, ne } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { profileSnapshots, variants } from "@/lib/db/schema";
import type { ProfileData } from "@/lib/profile";
import { normalizeProfileData } from "@/lib/profile";

/** Automatic snapshots kept per user. Manual ones are never pruned. */
export const AUTOMATIC_KEEP = 20;

export type SnapshotReason = "manual" | "clear" | "import" | "restore";

export type ProfileCounts = {
  sections: number;
  entries: number;
  bullets: number;
  groups: number;
};

export function profileCounts(data: ProfileData): ProfileCounts {
  let entries = 0;
  let bullets = 0;
  let groups = 0;
  for (const section of data.sections) {
    entries += section.entries.length;
    groups += section.groups.length;
    for (const entry of section.entries) bullets += entry.bullets.length;
  }
  return { sections: data.sections.length, entries, bullets, groups };
}

/** False for an empty memory, so clearing or importing into nothing is not logged. */
export function hasContent(data: ProfileData, rawDump = ""): boolean {
  const counts = profileCounts(data);
  return (
    counts.entries > 0 ||
    counts.bullets > 0 ||
    counts.groups > 0 ||
    data.sections.some((section) => section.text.trim().length > 0) ||
    Boolean(data.summary.trim()) ||
    Boolean(data.headline.trim()) ||
    rawDump.trim().length > 0
  );
}

export const REASON_LABELS: Record<string, string> = {
  manual: "Saved by hand",
  clear: "Before clearing",
  import: "Before import replaced the memory",
  restore: "Before restoring an older snapshot",
};

/**
 * Store a copy of the memory. Automatic snapshots are pruned oldest-first once
 * there are more than AUTOMATIC_KEEP of them; manual ones stay until deleted.
 */
export async function snapshotProfile(options: {
  userId: string;
  data: ProfileData;
  rawDump: string;
  reason: SnapshotReason;
  label?: string;
}): Promise<string | null> {
  const db = getDb();
  const [row] = await db
    .insert(profileSnapshots)
    .values({
      userId: options.userId,
      data: options.data,
      rawDump: options.rawDump,
      label: (options.label ?? "").slice(0, 160),
      reason: options.reason,
    })
    .returning({ id: profileSnapshots.id });

  if (options.reason !== "manual") {
    const stale = await db
      .select({ id: profileSnapshots.id })
      .from(profileSnapshots)
      .where(and(eq(profileSnapshots.userId, options.userId), ne(profileSnapshots.reason, "manual")))
      .orderBy(desc(profileSnapshots.createdAt))
      .offset(AUTOMATIC_KEEP);

    for (const snapshot of stale) {
      await db.delete(profileSnapshots).where(eq(profileSnapshots.id, snapshot.id));
    }
  }

  return row?.id ?? null;
}

/**
 * Keep variants usable after the memory changes shape: drop selections that no
 * longer exist and fall back to every remaining section when nothing is left.
 * Restoring an old snapshot reintroduces section ids a variant may never have
 * seen, so this runs on restore and clear.
 */
export async function repointVariants(userId: string, data: ProfileData): Promise<number> {
  const db = getDb();
  const sectionIds = data.sections.map((section) => section.id);
  const knownSections = new Set(sectionIds);
  const knownEntries = new Set(
    data.sections.flatMap((section) => section.entries.map((entry) => entry.id)),
  );

  const rows = await db.select().from(variants).where(eq(variants.userId, userId));
  let changed = 0;

  for (const variant of rows) {
    const sections = variant.sectionIds.filter((id) => knownSections.has(id));
    const entries = variant.entryIds.filter((id) => knownEntries.has(id));
    const nextSections = sections.length ? sections : sectionIds;
    const same =
      nextSections.length === variant.sectionIds.length &&
      entries.length === variant.entryIds.length &&
      nextSections.every((id, index) => variant.sectionIds[index] === id) &&
      entries.every((id, index) => variant.entryIds[index] === id);

    if (same) continue;
    await db
      .update(variants)
      .set({ sectionIds: nextSections, entryIds: entries, updatedAt: new Date() })
      .where(eq(variants.id, variant.id));
    changed += 1;
  }

  return changed;
}

/** Snapshots for a user, newest first, with counts for the history list. */
export async function listSnapshots(userId: string, limit = 50) {
  const rows = await getDb()
    .select({
      id: profileSnapshots.id,
      label: profileSnapshots.label,
      reason: profileSnapshots.reason,
      data: profileSnapshots.data,
      rawDump: profileSnapshots.rawDump,
      createdAt: profileSnapshots.createdAt,
    })
    .from(profileSnapshots)
    .where(eq(profileSnapshots.userId, userId))
    .orderBy(desc(profileSnapshots.createdAt))
    .limit(limit);

  return rows.map((row) => {
    const data = normalizeProfileData(row.data);
    return {
      id: row.id,
      label: row.label,
      reason: row.reason,
      createdAt: row.createdAt,
      counts: profileCounts(data),
      dumpChars: row.rawDump.length,
      name: data.identity.fullName,
      headline: data.headline,
    };
  });
}
