import type { NextRequest } from "next/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { assertSameOrigin, error, handleError, json, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { jobs } from "@/lib/db/schema";
import { fetchJobDescription } from "@/lib/fetch-url";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  company: z.string().max(160).optional().default(""),
  role: z.string().max(160).optional().default(""),
  sourceUrl: z.string().max(1000).optional().default(""),
  description: z.string().max(80_000).optional().default(""),
  variantId: z.string().uuid().optional().nullable(),
});

export async function GET() {
  try {
    const user = await requireUser();
    const rows = await getDb()
      .select()
      .from(jobs)
      .where(eq(jobs.userId, user.id))
      .orderBy(desc(jobs.updatedAt));
    return json({ jobs: rows });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    const body = await readJson(request, createSchema);

    let description = body.description.trim();
    let sourceUrl = body.sourceUrl.trim();
    let role = body.role.trim();

    if (!description && sourceUrl) {
      const fetched = await fetchJobDescription(sourceUrl);
      description = fetched.text;
      sourceUrl = fetched.url;
      if (!role) role = fetched.title.slice(0, 160);
    }

    if (!description) {
      return error("Paste the job description or add a link first.", 400);
    }

    const rows = await getDb()
      .insert(jobs)
      .values({
        userId: user.id,
        company: body.company.trim(),
        role,
        sourceUrl,
        description,
        variantId: body.variantId ?? null,
      })
      .returning();

    return json({ job: rows[0] }, 201);
  } catch (err) {
    return handleError(err);
  }
}
