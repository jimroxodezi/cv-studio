import "server-only";
import type { CoverLetter, ProfileData } from "@/lib/profile";
import { coverLetterSchema } from "@/lib/profile";
import type { UserRow } from "@/lib/db/schema";
import { completeJson, resolveProvider } from "@/lib/ai/provider";
import { COVER_LETTER_SYSTEM, coverLetterPrompt } from "@/lib/ai/prompts";
import { assertGenerationQuota, recordUsage } from "@/lib/rate-limit";
import { findSlopWarnings, findTextWarnings } from "@/lib/truthfulness";

export type CoverLetterJob = {
  company: string;
  role: string;
  description: string;
  notes: string;
};

export type CoverLetterAnalysis = {
  track: string;
  angle: string;
  keywords: string[];
  gaps: string[];
};

/** Words that end a letter. Models sometimes put one in the body as well. */
const SIGNOFFS = new Set([
  "sincerely",
  "sincerely yours",
  "yours sincerely",
  "yours truly",
  "regards",
  "best regards",
  "kind regards",
  "warm regards",
  "respectfully",
  "respectfully yours",
  "many thanks",
  "with thanks",
]);

function bare(value: string): string {
  return value.toLowerCase().replace(/[.,!;:]+$/g, "").trim();
}

/**
 * Strip a sign-off or the candidate's own name out of the body, where it would
 * print twice, and make sure the closing field is a real sign-off.
 */
export function tidyLetter(letter: CoverLetter, fullName: string): CoverLetter {
  const paragraphs = letter.paragraphs.map((entry) => entry.trim()).filter(Boolean);
  const name = fullName.trim().toLowerCase();

  const endsLetter = (value: string) => {
    const word = bare(value);
    return SIGNOFFS.has(word) || (name.length > 2 && word === name);
  };

  while (paragraphs.length > 1 && endsLetter(paragraphs[paragraphs.length - 1])) paragraphs.pop();

  const closing = SIGNOFFS.has(bare(letter.closing)) ? letter.closing.trim() : "Sincerely,";

  return { ...letter, paragraphs, closing };
}

/** The printed text of a letter, in reading order. */
export function letterTexts(letter: CoverLetter): string[] {
  return [letter.paragraphs.join("\n\n"), letter.greeting, letter.subject].filter(Boolean);
}

export function letterWordCount(letter: CoverLetter): number {
  return letter.paragraphs
    .join(" ")
    .split(/\s+/)
    .filter(Boolean).length;
}

/**
 * Warnings a person should read before sending. Split out so the API can reuse
 * them when a letter is edited and rebuilt by hand.
 */
export function reviewCoverLetter(profile: ProfileData, letter: CoverLetter): string[] {
  const texts = letterTexts(letter);
  const warnings = [
    ...findTextWarnings(profile, texts),
    ...findSlopWarnings(texts),
  ];

  const words = letterWordCount(letter);
  if (words > 420) {
    warnings.push(`This letter is ${words} words. Most recruiters stop reading around 300.`);
  }
  if (words < 140) {
    warnings.push(`This letter is only ${words} words. It may read as thin rather than brief.`);
  }
  if (letter.paragraphs.length > 5) {
    warnings.push("This letter has more than five paragraphs. Cut the weakest one.");
  }

  return [...new Set(warnings)].slice(0, 12);
}

async function draft(options: {
  user: UserRow;
  profile: ProfileData;
  job: CoverLetterJob;
  analysis: CoverLetterAnalysis | null;
  avoidStructures: string[];
  repair: string[];
  model?: string;
}): Promise<CoverLetter> {
  const config = resolveProvider(options.user);

  return completeJson({
    config,
    system: COVER_LETTER_SYSTEM,
    user: coverLetterPrompt({
      profile: options.profile,
      job: options.job,
      analysis: options.analysis,
      avoidStructures: options.avoidStructures,
      repair: options.repair,
    }),
    maxTokens: 3000,
    validate: (value) => coverLetterSchema.parse(value),
  });
}

/**
 * Write a letter, then check it. One repair pass is allowed when the draft trips
 * the template-language rules, because those are the ones that make a letter read
 * as machine-written.
 */
export async function writeCoverLetter(options: {
  user: UserRow;
  profile: ProfileData;
  job: CoverLetterJob;
  analysis?: CoverLetterAnalysis | null;
  avoidStructures?: string[];
}): Promise<{ letter: CoverLetter; warnings: string[]; model: string; repaired: boolean }> {
  const config = resolveProvider(options.user);
  await assertGenerationQuota(options.user.id, config.usedServerKey);

  const analysis = options.analysis ?? null;
  const avoidStructures = options.avoidStructures ?? [];

  const first = await draft({ ...options, analysis, avoidStructures, repair: [] });
  const firstSlop = findSlopWarnings(letterTexts(first));

  let letter = first;
  let repaired = false;

  if (firstSlop.length) {
    const second = await draft({
      ...options,
      analysis,
      avoidStructures,
      repair: firstSlop,
    });
    // Keep the second draft when it is objectively cleaner; a repair pass that
    // invents a new cliché is not an improvement.
    if (findSlopWarnings(letterTexts(second)).length < firstSlop.length) {
      letter = second;
      repaired = true;
    }
  }

  await recordUsage(options.user.id, "cover-letter", config.model, config.usedServerKey);

  letter = tidyLetter(letter, options.profile.identity.fullName);

  return {
    letter,
    warnings: reviewCoverLetter(options.profile, letter),
    model: config.model,
    repaired,
  };
}
