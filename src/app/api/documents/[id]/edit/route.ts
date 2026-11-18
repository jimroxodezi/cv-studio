import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { assertSameOrigin, error, handleError, json, readJson, UserError } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { documents, type DocumentRow } from "@/lib/db/schema";
import { ensureProfile, getOwnedJob, getOwnedVariant } from "@/lib/guards";
import type { ProfileData } from "@/lib/profile";
import { buildTailoredDocument, buildVariantDocument, variantToData } from "@/lib/cv-document";
import { storedCvDocument } from "@/lib/cv-edit";
import { renderBody, type CvDocument } from "@/lib/latex/render";
import { compileCv } from "@/lib/latex/compile";
import { atsWarnings } from "@/lib/truthfulness";
import { editCv } from "@/lib/ai/edit";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const schema = z.object({
  instruction: z.string().trim().min(3).max(2000),
});

type DocumentMeta = {
  document?: unknown;
  target?: number;
  edit?: unknown;
};

/**
 * Older documents were compiled without storing their structured source. They
 * can still be edited by rebuilding that source from the job or variant they
 * came from, which is what the latest version of each was compiled from.
 */
async function sourceDocument(row: DocumentRow, profile: ProfileData): Promise<CvDocument> {
  const stored = storedCvDocument(row.meta);
  if (stored) return stored;

  if (row.kind === "tailored" && row.jobId) {
    const job = await getOwnedJob(row.userId, row.jobId);
    const variantId = row.variantId ?? job.variantId;
    if (!variantId || !job.result) {
      throw new UserError("This version has no editable source. Tailor the CV again, then edit the new version.", 409);
    }
    const variant = await getOwnedVariant(row.userId, variantId);
    return buildTailoredDocument(profile, variantToData(variant), job.result);
  }

  if (row.kind === "variant" && row.variantId) {
    const variant = await getOwnedVariant(row.userId, row.variantId);
    return buildVariantDocument(profile, variantToData(variant));
  }

  throw new UserError(
    "This version was built before prompt edits existed. Rebuild the CV, then edit it.",
    409,
  );
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    const { id } = await params;
    const body = await readJson(request, schema);

    const rows = await getDb()
      .select()
      .from(documents)
      .where(eq(documents.id, id))
      .limit(1);
    const source = rows[0];
    if (!source || source.userId !== user.id) return error("That document could not be found.", 404);
    if (source.kind === "cover_letter") {
      return error("Cover letters are edited in the cover letter panel.", 400);
    }

    const profile = await ensureProfile(user);
    const original = await sourceDocument(source, profile);
    const meta = (source.meta ?? {}) as DocumentMeta;
    const pageTarget = meta.target === 2 ? 2 : 1;

    const edited = await editCv({
      user,
      profile,
      document: original,
      instruction: body.instruction,
      pageCount: source.pageCount,
      pageTarget,
    });

    // Nothing visible changed: keep the version count down and explain why.
    if (!edited.changed) {
      return json({
        documentId: source.id,
        pageCount: source.pageCount,
        warnings: source.warnings,
        changes: [],
        notes: edited.notes,
        model: edited.model,
        atsPreview: source.atsText.slice(0, 2000),
      });
    }

    const compiled = await compileCv(renderBody(edited.document));
    const warnings = [
      ...new Set([
        ...edited.warnings,
        ...compiled.warnings,
        ...atsWarnings(compiled.pageCount, compiled.atsText, pageTarget),
      ]),
    ];

    const [created] = await getDb()
      .insert(documents)
      .values({
        userId: user.id,
        jobId: source.jobId,
        variantId: source.variantId,
        kind: source.kind,
        label: source.label,
        latex: compiled.latex,
        pdf: compiled.pdf,
        pageCount: compiled.pageCount,
        atsText: compiled.atsText,
        warnings,
        meta: {
          ...meta,
          document: edited.document,
          editedFrom: source.id,
          edit: { instruction: body.instruction, changes: edited.changes },
          model: edited.model,
          target: pageTarget,
        },
      })
      .returning({ id: documents.id });

    return json({
      documentId: created.id,
      pageCount: compiled.pageCount,
      warnings,
      changes: edited.changes,
      notes: edited.notes,
      model: edited.model,
      atsPreview: compiled.atsText.slice(0, 2000),
    });
  } catch (err) {
    return handleError(err);
  }
}
