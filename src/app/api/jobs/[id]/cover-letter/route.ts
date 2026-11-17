import type { NextRequest } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { assertSameOrigin, error, handleError, json, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import { ensureProfile, getOwnedJob } from "@/lib/guards";
import { compileLetter } from "@/lib/latex/compile";
import { renderCoverLetter } from "@/lib/latex/letter";
import { coverLetterEditSchema, coverLetterSchema } from "@/lib/profile";
import { letterTexts, reviewCoverLetter, tidyLetter, writeCoverLetter } from "@/lib/ai/cover-letter";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const generateSchema = z.object({
  /** Extra direction from the candidate, e.g. "mention the relocation". */
  steer: z.string().max(2000).optional(),
});

const rebuildSchema = coverLetterEditSchema.extend({
  documentId: z.string().uuid(),
});

function label(company: string, role: string): string {
  return `Cover letter — ${company || "application"}${role ? ` — ${role}` : ""}`;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    const { id } = await params;
    const job = await getOwnedJob(user.id, id);
    const body = await readJson(request, generateSchema);
    const profile = await ensureProfile(user);

    if (job.description.trim().length < 40) {
      return error("Add the job description first — the letter has to answer it.", 400);
    }
    if (!profile.identity.fullName.trim()) {
      return error("Add your name to the career memory first.", 400);
    }

    // Ask for a structure the last few letters did not use, so a candidate who
    // writes several letters does not send the same shape each time.
    const recent = await getDb()
      .select({ meta: documents.meta })
      .from(documents)
      .where(and(eq(documents.jobId, job.id), eq(documents.userId, user.id), eq(documents.kind, "cover_letter")))
      .orderBy(desc(documents.createdAt))
      .limit(3);

    const avoidStructures = recent
      .map((row) => (row.meta as { letter?: { structure?: string } }).letter?.structure ?? "")
      .filter(Boolean);

    const notes = [job.notes, body.steer].filter(Boolean).join("\n").trim();

    const written = await writeCoverLetter({
      user,
      profile,
      job: {
        company: job.company,
        role: job.role,
        description: job.description,
        notes,
      },
      analysis: job.analysis
        ? {
            track: job.analysis.track,
            angle: job.analysis.angle,
            keywords: job.analysis.keywords,
            gaps: job.analysis.gaps,
          }
        : null,
      avoidStructures,
    });

    const date = today();
    const rendered = renderCoverLetter({
      identity: profile.identity,
      company: job.company,
      role: job.role,
      date,
      letter: written.letter,
    });
    const compiled = await compileLetter(rendered);

    const warnings = [...new Set([...written.warnings, ...compiled.warnings])];

    const [document] = await getDb()
      .insert(documents)
      .values({
        userId: user.id,
        jobId: job.id,
        kind: "cover_letter",
        label: label(job.company, job.role),
        latex: compiled.latex,
        pdf: compiled.pdf,
        pageCount: compiled.pageCount,
        atsText: compiled.atsText,
        warnings,
        meta: {
          model: written.model,
          repaired: written.repaired,
          date,
          company: job.company,
          role: job.role,
          letter: written.letter,
        },
      })
      .returning({ id: documents.id });

    return json({
      documentId: document.id,
      letter: written.letter,
      warnings,
      pageCount: compiled.pageCount,
      model: written.model,
      repaired: written.repaired,
    });
  } catch (err) {
    return handleError(err);
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    const { id } = await params;
    const job = await getOwnedJob(user.id, id);
    const body = await readJson(request, rebuildSchema);
    const profile = await ensureProfile(user);

    const rows = await getDb()
      .select()
      .from(documents)
      .where(and(eq(documents.id, body.documentId), eq(documents.userId, user.id)))
      .limit(1);
    const existing = rows[0];
    if (!existing || existing.kind !== "cover_letter") {
      return error("That cover letter could not be found.", 404);
    }

    const meta = existing.meta as {
      letter?: unknown;
      date?: string;
      company?: string;
      role?: string;
      model?: string;
    };
    const stored = coverLetterSchema.parse(meta.letter ?? {});
    const letter = tidyLetter(
      {
        ...stored,
        subject: body.subject,
        greeting: body.greeting,
        paragraphs: body.paragraphs,
        closing: body.closing,
      },
      profile.identity.fullName,
    );

    const rendered = renderCoverLetter({
      identity: profile.identity,
      company: meta.company ?? job.company,
      role: meta.role ?? job.role,
      date: meta.date ?? today(),
      letter,
    });
    const compiled = await compileLetter(rendered);
    const warnings = [...new Set([...reviewCoverLetter(profile, letter), ...compiled.warnings])];

    await getDb()
      .update(documents)
      .set({
        latex: compiled.latex,
        pdf: compiled.pdf,
        pageCount: compiled.pageCount,
        atsText: compiled.atsText,
        warnings,
        meta: { ...meta, letter },
      })
      .where(eq(documents.id, existing.id));

    return json({
      documentId: existing.id,
      letter,
      warnings,
      pageCount: compiled.pageCount,
      chars: letterTexts(letter).join(" ").length,
    });
  } catch (err) {
    return handleError(err);
  }
}
