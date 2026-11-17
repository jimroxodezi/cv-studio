import "server-only";
import type { ProfileData, ProfileEntry, ProfileSection, TailorResult, VariantData } from "@/lib/profile";
import { tailorResultSchema } from "@/lib/profile";
import type { UserRow } from "@/lib/db/schema";
import { completeJson, resolveProvider } from "@/lib/ai/provider";
import { SYSTEM_PROMPT, tailorPrompt } from "@/lib/ai/prompts";
import { assertGenerationQuota, recordUsage } from "@/lib/rate-limit";
import { findClaimWarnings } from "@/lib/truthfulness";

type SectionIndex = {
  sections: Set<string>;
  entries: Map<string, { section: ProfileSection; entry: ProfileEntry }>;
  groupSections: Set<string>;
  textSections: Set<string>;
};

function indexProfile(profile: ProfileData): SectionIndex {
  const sections = new Set<string>();
  const entries = new Map<string, { section: ProfileSection; entry: ProfileEntry }>();
  const groupSections = new Set<string>();
  const textSections = new Set<string>();

  for (const section of profile.sections) {
    sections.add(section.id);
    if (section.kind === "entries") {
      for (const entry of section.entries) entries.set(entry.id, { section, entry });
    } else if (section.kind === "groups") {
      groupSections.add(section.id);
    } else {
      textSections.add(section.id);
    }
  }

  return { sections, entries, groupSections, textSections };
}

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

  const index = indexProfile(options.profile);

  const unknownEntries = result.document.entries
    .filter((entry) => !index.entries.has(entry.entryId))
    .map((entry) => entry.entryId);
  result.document.entries = result.document.entries.filter((entry) => index.entries.has(entry.entryId));

  const unknownGroupSections = result.document.groups
    .filter((section) => !index.groupSections.has(section.sectionId))
    .map((section) => section.sectionId);
  result.document.groups = result.document.groups.filter((section) =>
    index.groupSections.has(section.sectionId),
  );

  const unknownTextSections = result.document.texts
    .filter((section) => !index.textSections.has(section.sectionId))
    .map((section) => section.sectionId);
  result.document.texts = result.document.texts.filter((section) =>
    index.textSections.has(section.sectionId),
  );

  result.document.sectionOrder = result.document.sectionOrder.filter((id) => index.sections.has(id));

  const badRefs = [...unknownEntries, ...unknownGroupSections, ...unknownTextSections];
  if (badRefs.length) {
    result.gaps.push(
      `The model referenced ids that are not in the memory: ${[...new Set(badRefs)].join(", ")}.`,
    );
  }

  if (!result.document.entries.length && !result.document.groups.length && !result.document.texts.length) {
    // Never return a blank CV because the model was over-eager. Fall back to the
    // entries the variant already selected, with their original bullets.
    const selected = new Set(options.variant.entryIds);
    const fallbackEntries = options.profile.sections.flatMap((section) =>
      section.kind === "entries"
        ? section.entries
            .filter((entry) => selected.has(entry.id))
            .slice(0, 4)
            .map((entry) => ({
              entryId: entry.id,
              bullets: entry.bullets.slice(0, 5).map((bullet) => ({
                text: bullet.text,
                sourceBulletIds: [bullet.id],
              })),
            }))
        : [],
    );

    if (fallbackEntries.length) {
      result.document.entries = fallbackEntries;
      if (!result.document.sectionOrder.length) {
        result.document.sectionOrder = [...index.sections];
      }
      result.gaps.push("The model returned no entries; the base bullets were kept as a fallback.");
    }
  }

  const warnings = findClaimWarnings(options.profile, result);
  await recordUsage(options.user.id, "tailor", config.model, config.usedServerKey);
  return { result, warnings, model: config.model };
}
