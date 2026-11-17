import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { assertSameOrigin, handleError, json, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { variants } from "@/lib/db/schema";
import { getOwnedVariant } from "@/lib/guards";
import { variantDataSchema } from "@/lib/profile";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const variant = await getOwnedVariant(user.id, id);
    return json({ variant });
  } catch (err) {
    return handleError(err);
  }
}

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    const { id } = await params;
    await getOwnedVariant(user.id, id);
    const body = await readJson(request, variantDataSchema);
    const rows = await getDb()
      .update(variants)
      .set({
        name: body.name,
        track: body.track,
        summary: body.summary,
        sectionOrder: body.sectionOrder,
        skillGroupIds: body.skillGroupIds,
        experienceIds: body.experienceIds,
        projectIds: body.projectIds,
        educationIds: body.educationIds,
        options: body.options,
        updatedAt: new Date(),
      })
      .where(eq(variants.id, id))
      .returning();
    return json({ variant: rows[0] });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    const { id } = await params;
    await getOwnedVariant(user.id, id);
    await getDb().delete(variants).where(eq(variants.id, id));
    return json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
