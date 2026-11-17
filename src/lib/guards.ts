import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { jobs, profiles, variants } from "@/lib/db/schema";
import type { JobRow, ProfileRow, VariantRow } from "@/lib/db/schema";
import { emptyProfile, type ProfileData } from "@/lib/profile";
import type { UserRow } from "@/lib/db/schema";

export async function ensureProfile(user: UserRow): Promise<ProfileData> {
  const db = getDb();
  const rows = await db.select().from(profiles).where(eq(profiles.userId, user.id)).limit(1);
  if (rows[0]) return rows[0].data;
  const data = emptyProfile(user.email, user.name);
  await db.insert(profiles).values({ userId: user.id, data }).onConflictDoNothing();
  return data;
}

export async function getProfileRow(userId: string): Promise<ProfileRow | null> {
  const rows = await getDb().select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
  return rows[0] ?? null;
}

export async function getOwnedVariant(userId: string, id: string): Promise<VariantRow> {
  const rows = await getDb()
    .select()
    .from(variants)
    .where(eq(variants.id, id))
    .limit(1);
  const variant = rows[0];
  if (!variant || variant.userId !== userId) throw new Error("NOT_FOUND");
  return variant;
}

export async function getOwnedJob(userId: string, id: string): Promise<JobRow> {
  const rows = await getDb().select().from(jobs).where(eq(jobs.id, id)).limit(1);
  const job = rows[0];
  if (!job || job.userId !== userId) throw new Error("NOT_FOUND");
  return job;
}
