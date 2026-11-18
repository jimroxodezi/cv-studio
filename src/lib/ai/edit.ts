import "server-only";
import type { ProfileData } from "@/lib/profile";
import type { CvDocument } from "@/lib/latex/render";
import type { UserRow } from "@/lib/db/schema";
import { completeJson, resolveProvider } from "@/lib/ai/provider";
import { CV_EDIT_SYSTEM, cvEditPrompt } from "@/lib/ai/prompts";
import { assertGenerationQuota, recordUsage } from "@/lib/rate-limit";
import { applyCvEdit, cvEditSchema, editedTexts } from "@/lib/cv-edit";
import { findTextWarnings } from "@/lib/truthfulness";

export type EditCvOutcome = {
  document: CvDocument;
  changes: string[];
  notes: string;
  warnings: string[];
  model: string;
  changed: boolean;
};

/**
 * Applies one instruction to a compiled CV. The model edits the structured
 * document; identity fields are pinned by the merge, so the worst a bad answer
 * can do is rewrite bullets badly, never invent a job. Truthfulness warnings
 * are advisory, exactly as they are after tailoring.
 */
export async function editCv(options: {
  user: UserRow;
  profile: ProfileData;
  document: CvDocument;
  instruction: string;
  pageCount: number;
  pageTarget: number;
}): Promise<EditCvOutcome> {
  const config = resolveProvider(options.user);
  await assertGenerationQuota(options.user.id, config.usedServerKey);

  const edit = await completeJson({
    config,
    system: CV_EDIT_SYSTEM,
    user: cvEditPrompt(options),
    maxTokens: 6000,
    validate: (value) => cvEditSchema.parse(value),
  });

  const merged = applyCvEdit(options.document, edit, options.profile);
  const warnings = findTextWarnings(options.profile, editedTexts(merged.document));

  // A model that offered "Added Kubernetes to your skills" must not keep that
  // line when the merge refused the item; the change list has to describe the
  // CV the user is about to see.
  const dropped = merged.droppedItems.map((item) => item.toLowerCase());
  const changes = edit.changes
    .map((change) => change.trim())
    .filter(Boolean)
    .filter((change) => !dropped.some((item) => change.toLowerCase().includes(item)))
    .slice(0, 6);

  if (merged.droppedItems.length) {
    changes.unshift(
      `Left ${merged.droppedItems.map((item) => `“${item}”`).join(", ")} off the CV: not in your career memory.`,
    );
  }

  await recordUsage(options.user.id, "edit", config.model, config.usedServerKey);

  return {
    document: merged.document,
    changes: merged.changed ? (changes.length ? changes.slice(0, 6) : ["Edited the CV."]) : [],
    notes: merged.notes.join("\n"),
    warnings,
    model: config.model,
    changed: merged.changed,
  };
}
