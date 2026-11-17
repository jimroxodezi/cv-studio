import "server-only";
import type { ProfileData, ProfileSuggestion } from "@/lib/profile";
import { emptyProfile, normalizeProfileData, profileHasContent } from "@/lib/profile";
import { mergeSuggestions } from "@/lib/cv-suggestions";
import type { UserRow } from "@/lib/db/schema";
import { completeJson, resolveProvider } from "@/lib/ai/provider";
import { SYSTEM_PROMPT, importPrompt } from "@/lib/ai/prompts";
import { assertGenerationQuota, recordUsage } from "@/lib/rate-limit";

type Loose = Record<string, unknown>;

function record(value: unknown): Loose {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Loose) : {};
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function strArray(value: unknown): string[] {
  return array(value)
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function validEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

type NormalizedImport = {
  profile: ProfileData;
  suggestedTracks: string[];
  gaps: string[];
  suggestions: ProfileSuggestion[];
};

/**
 * The import model returns the same generic section shape the rest of the app
 * uses. This keeps the identity safe, drops rows the schema cannot store, and
 * reports what was dropped instead of failing the whole import.
 */
export function normalizeImport(raw: unknown, fallback: ProfileData): NormalizedImport {
  const root = record(raw);
  const source = record(root.profile ?? root);

  const identity: Loose = {
    ...fallback.identity,
    ...record(source.identity),
  };
  const PLACEHOLDERS = /^(unknown|candidate|your name|name|n\/?a|none|not provided|not stated)$/i;
  if (!str(identity.fullName).trim() || PLACEHOLDERS.test(str(identity.fullName).trim())) {
    identity.fullName = fallback.identity.fullName;
  }
  if (!validEmail(str(identity.email))) identity.email = fallback.identity.email;

  const positioning: Record<string, string> = {};
  for (const [key, value] of Object.entries(record(source.positioning))) {
    if (typeof value === "string" && value.trim()) positioning[key.slice(0, 80)] = value;
  }

  // Count incomplete rows before normalisation so the candidate knows what the
  // model dropped rather than silently wondering where an entry went.
  let missingEntryHeading = 0;
  let emptyGroups = 0;
  for (const sectionRaw of array(source.sections)) {
    const section = record(sectionRaw);
    for (const entryRaw of array(section.entries)) {
      if (!str(record(entryRaw).heading).trim()) missingEntryHeading += 1;
    }
    for (const groupRaw of array(section.groups)) {
      const group = record(groupRaw);
      if (!str(group.label).trim() || !strArray(group.items).length) emptyGroups += 1;
    }
  }

  const profile = normalizeProfileData({
    ...source,
    identity,
    headline: str(source.headline),
    summary: str(source.summary),
    positioning,
    sections: source.sections,
    doNotClaim: strArray(source.doNotClaim),
    notes: str(source.notes),
  });

  const warnings: string[] = [];
  if (missingEntryHeading) {
    const single = missingEntryHeading === 1;
    warnings.push(
      `${missingEntryHeading} extracted ${single ? "entry was" : "entries were"} missing a heading and ${
        single ? "was" : "were"
      } skipped — add ${single ? "it" : "them"} on the profile page.`,
    );
  }
  if (emptyGroups) {
    const single = emptyGroups === 1;
    warnings.push(
      `${emptyGroups} extracted ${single ? "group was" : "groups were"} missing a label or items and ${
        single ? "was" : "were"
      } skipped.`,
    );
  }
  if (!profileHasContent(profile)) {
    warnings.push(
      "The dump did not contain enough detail for a full CV. A short CV can still be built, but add your history on the profile page to give it substance.",
    );
  }

  return {
    profile,
    suggestedTracks: strArray(root.suggestedTracks)
      .map((track) => track.slice(0, 60))
      .slice(0, 6),
    gaps: [...warnings, ...strArray(root.gaps)].slice(0, 30),
    suggestions: mergeSuggestions(profile, root.suggestions),
  };
}

export async function extractCareerDump(options: {
  user: UserRow;
  dump: string;
}): Promise<{
  profile: ProfileData;
  suggestedTracks: string[];
  gaps: string[];
  suggestions: ProfileSuggestion[];
  model: string;
}> {
  const config = resolveProvider(options.user);
  await assertGenerationQuota(options.user.id, config.usedServerKey);

  const fallback = emptyProfile(options.user.email, options.user.name);
  // Validate inside completeJson so a shape the app cannot use triggers the
  // one repair attempt instead of escaping as a raw schema error.
  const normalized = await completeJson<NormalizedImport>({
    config,
    system: SYSTEM_PROMPT,
    user: importPrompt(options.dump, options.user.name, options.user.email),
    maxTokens: 8000,
    validate: (value) => normalizeImport(value, fallback),
  });

  await recordUsage(options.user.id, "import", config.model, config.usedServerKey);
  return { ...normalized, model: config.model };
}
