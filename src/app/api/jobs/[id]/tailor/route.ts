import type { NextRequest } from "next/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { assertSameOrigin, error, handleError, json, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { documents, jobs, variants } from "@/lib/db/schema";
import { ensureProfile, getOwnedJob, getOwnedVariant } from "@/lib/guards";
import { buildTailoredDocument, defaultSectionOrder, variantToData } from "@/lib/cv-document";
import { renderBody } from "@/lib/latex/render";
import { compileCv } from "@/lib/latex/compile";
import { atsWarnings } from "@/lib/truthfulness";
import { tailorCv } from "@/lib/ai/tailor";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const schema = z.object({
  variantId: z.string().uuid().optional(),
  notes: z.string().max(5000).optional(),
});

export async function POST(request: NextRequest, { params }: Params) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    const { id } = await params;
    const job = await getOwnedJob(user.id, id);
    const body = await readJson(request, schema);
    const profile = await ensureProfile(user);

    if (!profile.experience.length) {
      return error("Add at least one role to your career memory before tailoring.", 400);
    }
    if (job.description.trim().length < 40) {
      return error("Add the job description first.", 400);
    }

    const variantId = body.variantId ?? job.variantId ?? undefined;
    let variant = variantId ? await getOwnedVariant(user.id, variantId) : null;
    if (!variant) {
      const existing = await getDb()
        .select()
        .from(variants)
        .where(eq(variants.userId, user.id))
        .orderBy(desc(variants.updatedAt))
        .limit(1);
      variant = existing[0] ?? null;
    }
    if (!variant) {
      const created = await getDb()
        .insert(variants)
        .values({
          userId: user.id,
          name: "General",
          track: "general",
          summary: profile.summary || profile.positioning.general || "",
          sectionOrder: defaultSectionOrder(),
          skillGroupIds: profile.skillGroups.map((group) => group.id),
          experienceIds: profile.experience.map((entry) => entry.id),
          projectIds: profile.projects.map((entry) => entry.id),
          educationIds: profile.education.map((entry) => entry.id),
          options: { pageTarget: 1, showSummary: true, showSkills: true },
        })
        .returning();
      variant = created[0];
    }

    const notes = body.notes ?? job.notes;
    const tailored = await tailorCv({
      user,
      profile,
      variant: variantToData(variant),
      job: {
        company: job.company,
        role: job.role,
        description: job.description,
        notes,
      },
    });

    const doc = buildTailoredDocument(profile, variantToData(variant), tailored.result);
    const compiled = await compileCv(renderBody(doc));
    const warnings = [
      ...tailored.warnings,
      ...compiled.warnings,
      ...atsWarnings(compiled.pageCount, compiled.atsText, variant.options.pageTarget),
    ];

    const [document] = await getDb()
      .insert(documents)
      .values({
        userId: user.id,
        jobId: job.id,
        variantId: variant.id,
        kind: "tailored",
        label: `${job.company || "Application"} — ${job.role || "tailored CV"}`,
        latex: compiled.latex,
        pdf: compiled.pdf,
        pageCount: compiled.pageCount,
        atsText: compiled.atsText,
        warnings,
        meta: {
          track: tailored.result.analysis.track,
          model: tailored.model,
          target: variant.options.pageTarget,
        },
      })
      .returning({ id: documents.id });

    await getDb()
      .update(jobs)
      .set({
        variantId: variant.id,
        notes,
        status: "tailored",
        analysis: tailored.result.analysis,
        result: tailored.result,
        updatedAt: new Date(),
      })
      .where(eq(jobs.id, job.id));

    return json({
      documentId: document.id,
      pageCount: compiled.pageCount,
      warnings,
      analysis: tailored.result.analysis,
      keywordCoverage: tailored.result.keywordCoverage,
      gaps: tailored.result.gaps,
      notes: tailored.result.notes,
      model: tailored.model,
    });
  } catch (err) {
    return handleError(err);
  }
}
