import type { NextRequest } from "next/server";
import { assertSameOrigin, handleError, json } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import { ensureProfile, getOwnedVariant } from "@/lib/guards";
import { buildVariantDocument, variantToData } from "@/lib/cv-document";
import { renderBody } from "@/lib/latex/render";
import { compileCv } from "@/lib/latex/compile";
import { atsWarnings } from "@/lib/truthfulness";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    const { id } = await params;
    const variant = await getOwnedVariant(user.id, id);
    const profile = await ensureProfile(user);
    const data = variantToData(variant);
    const doc = buildVariantDocument(profile, data);
    const body = renderBody(doc);
    const compiled = await compileCv(body);
    const warnings = [
      ...compiled.warnings,
      ...atsWarnings(compiled.pageCount, compiled.atsText, data.options.pageTarget),
    ];

    const rows = await getDb()
      .insert(documents)
      .values({
        userId: user.id,
        variantId: variant.id,
        kind: "variant",
        label: `${variant.name} — base CV`,
        latex: compiled.latex,
        pdf: compiled.pdf,
        pageCount: compiled.pageCount,
        atsText: compiled.atsText,
        warnings,
        // The structured source is what prompt edits operate on; without it,
        // an edit would have to guess what the PDF was built from.
        meta: { track: variant.track, target: data.options.pageTarget, document: doc },
      })
      .returning({ id: documents.id });

    return json({
      documentId: rows[0].id,
      pageCount: compiled.pageCount,
      warnings,
      atsPreview: compiled.atsText.slice(0, 2000),
    });
  } catch (err) {
    return handleError(err);
  }
}
