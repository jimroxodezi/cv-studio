import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { assertSameOrigin, handleError, json, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { jobs } from "@/lib/db/schema";
import { getOwnedJob } from "@/lib/guards";
import { fetchJobDescription } from "@/lib/fetch-url";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const schema = z.object({ url: z.string().max(1000).optional() });

export async function POST(request: NextRequest, { params }: Params) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    const { id } = await params;
    const job = await getOwnedJob(user.id, id);
    const body = await readJson(request, schema);
    const url = (body.url || job.sourceUrl).trim();
    if (!url) throw new Error("Add a link first.");

    const fetched = await fetchJobDescription(url);
    const rows = await getDb()
      .update(jobs)
      .set({
        description: fetched.text,
        sourceUrl: fetched.url,
        role: job.role || fetched.title.slice(0, 160),
        updatedAt: new Date(),
      })
      .where(eq(jobs.id, id))
      .returning();

    return json({ job: rows[0], title: fetched.title, text: fetched.text });
  } catch (err) {
    return handleError(err);
  }
}
