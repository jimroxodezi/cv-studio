import "server-only";
import { and, count, eq, gte } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { usageEvents } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { UserError } from "@/lib/api";

export async function assertGenerationQuota(userId: string, usesServerKey: boolean): Promise<void> {
  if (!usesServerKey) return;
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const rows = await getDb()
    .select({ total: count() })
    .from(usageEvents)
    .where(
      and(
        eq(usageEvents.userId, userId),
        eq(usageEvents.usedServerKey, true),
        gte(usageEvents.createdAt, since),
      ),
    );
  const used = Number(rows[0]?.total ?? 0);
  if (used >= env.freeGenerationsPerDay) {
    throw new UserError(
      `Daily free limit reached (${env.freeGenerationsPerDay}). Add your own API key in Settings to keep going.`,
      429,
    );
  }
}

export async function recordUsage(
  userId: string,
  kind: string,
  model: string,
  usedServerKey: boolean,
): Promise<void> {
  await getDb().insert(usageEvents).values({ userId, kind, model, usedServerKey });
}
