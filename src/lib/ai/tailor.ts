import "server-only";
import type { ProfileData, TailorResult, VariantData } from "@/lib/profile";
import { tailorResultSchema } from "@/lib/profile";
import type { UserRow } from "@/lib/db/schema";
import { completeJson, resolveProvider } from "@/lib/ai/provider";
import { SYSTEM_PROMPT, tailorPrompt } from "@/lib/ai/prompts";
import { assertGenerationQuota, recordUsage } from "@/lib/rate-limit";
import { findClaimWarnings } from "@/lib/truthfulness";

export async function tailorCv(options: {
  user: UserRow;
  profile: ProfileData;
  variant: VariantData;
  job: { company: string; role: string; description: string; notes: string };
}): Promise<{ result: TailorResult; warnings: string[]; model: string }> {
  const config = resolveProvider(options.user);
  await assertGenerationQuota(options.user.id, config.usedServerKey);

  const result = await completeJson({
    config,
    system: SYSTEM_PROMPT,
    user: tailorPrompt(options.profile, options.variant, options.job),
    maxTokens: 6000,
    validate: (value) => tailorResultSchema.parse(value),
  });

  const experienceIds = new Set(options.profile.experience.map((entry) => entry.id));
  const projectIds = new Set(options.profile.projects.map((entry) => entry.id));
  const educationIds = new Set(options.profile.education.map((entry) => entry.id));

  const unknownEntries = [
    ...result.document.experience.filter((entry) => !experienceIds.has(entry.entryId)).map((entry) => entry.entryId),
    ...result.document.projects.filter((entry) => !projectIds.has(entry.entryId)).map((entry) => entry.entryId),
  ];
  if (unknownEntries.length) {
    result.document.experience = result.document.experience.filter((entry) =>
      experienceIds.has(entry.entryId),
    );
    result.document.projects = result.document.projects.filter((entry) =>
      projectIds.has(entry.entryId),
    );
    result.gaps.push(`The model referenced entries that are not in the memory: ${unknownEntries.join(", ")}.`);
  }
  result.document.educationIds = result.document.educationIds.filter((id) => educationIds.has(id));

  if (!result.document.experience.length && options.profile.experience.length) {
    // Never return a CV with no experience because the model was over-eager.
    const selected = options.profile.experience.filter((entry) =>
      options.variant.experienceIds.includes(entry.id),
    );
    if (selected.length) {
      result.document.experience = selected.slice(0, 4).map((entry) => ({
        entryId: entry.id,
        bullets: entry.bullets.slice(0, 5).map((bullet) => ({
          text: bullet.text,
          sourceBulletIds: [bullet.id],
        })),
      }));
      result.gaps.push("The model returned no experience; the base bullets were kept as a fallback.");
    }
  }

  const warnings = findClaimWarnings(options.profile, result);
  await recordUsage(options.user.id, "tailor", config.model, config.usedServerKey);
  return { result, warnings, model: config.model };
}
