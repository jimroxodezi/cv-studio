import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { assertSameOrigin, handleError, json, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { jobs } from "@/lib/db/schema";
import { getOwnedJob } from "@/lib/guards";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const putSchema = z.object({
  company: z.string().max(160).optional(),
  role: z.string().max(160).optional(),
  sourceUrl: z.string().max(1000).optional(),
  description: z.string().max(80_000).optional(),
  notes: z.string().max(5000).optional(),
  variantId: z.string().uuid().nullable().optional(),
  status: z.string().max(40).optional(),
});

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const job = await getOwnedJob(user.id, id);
    return json({ job });
  } catch (err) {
    return handleError(err);
  }
}

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    const { id } = await params;
    await getOwnedJob(user.id, id);
    const body = await readJson(request, putSchema);
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    for (const key of ["company", "role", "sourceUrl", "description", "notes", "status"] as const) {
      if (body[key] !== undefined) updates[key] = body[key];
    }
    if (body.variantId !== undefined) updates.variantId = body.variantId;
    const rows = await getDb().update(jobs).set(updates).where(eq(jobs.id, id)).returning();
    return json({ job: rows[0] });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    const { id } = await params;
    await getOwnedJob(user.id, id);
    await getDb().delete(jobs).where(eq(jobs.id, id));
    return json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
