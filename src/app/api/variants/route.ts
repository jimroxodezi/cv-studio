import type { NextRequest } from "next/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { assertSameOrigin, handleError, json, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { variants } from "@/lib/db/schema";
import { ensureProfile } from "@/lib/guards";
import { defaultSectionOrder } from "@/lib/cv-document";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  track: z.string().trim().min(1).max(60),
  summary: z.string().max(2000).optional(),
});

export async function GET() {
  try {
    const user = await requireUser();
    const rows = await getDb()
      .select()
      .from(variants)
      .where(eq(variants.userId, user.id))
      .orderBy(desc(variants.updatedAt));
    return json({ variants: rows });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    const body = await readJson(request, createSchema);
    const profile = await ensureProfile(user);

    const rows = await getDb()
      .insert(variants)
      .values({
        userId: user.id,
        name: body.name,
        track: body.track,
        summary: body.summary ?? profile.positioning[body.track] ?? "",
        sectionOrder: defaultSectionOrder(),
        skillGroupIds: profile.skillGroups.map((group) => group.id),
        experienceIds: profile.experience.map((entry) => entry.id),
        projectIds: profile.projects.map((entry) => entry.id),
        educationIds: profile.education.map((entry) => entry.id),
        options: { pageTarget: 1, showSummary: true, showSkills: true },
      })
      .returning();

    return json({ variant: rows[0] }, 201);
  } catch (err) {
    return handleError(err);
  }
}
