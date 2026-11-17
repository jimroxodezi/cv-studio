import type { ProfileData, TailorResult } from "@/lib/profile";

const CLAIM_PATTERN = /\b\d[\d,.]*(?:\+|%|k|K)?\b/g;

const NUMBER_WORDS: Record<string, string> = {
  one: "1",
  two: "2",
  three: "3",
  four: "4",
  five: "5",
  six: "6",
  seven: "7",
  eight: "8",
  nine: "9",
  ten: "10",
  eleven: "11",
  twelve: "12",
  thirteen: "13",
  fourteen: "14",
  fifteen: "15",
  sixteen: "16",
  seventeen: "17",
  eighteen: "18",
  nineteen: "19",
  twenty: "20",
  thirty: "30",
  forty: "40",
  fifty: "50",
  sixty: "60",
  seventy: "70",
  eighty: "80",
  ninety: "90",
  hundred: "100",
  thousand: "1000",
};

const NUMBER_WORD_PATTERN = Object.keys(NUMBER_WORDS).join("|");

const SCOPE_NOUNS =
  "programs?|projects?|sites?|people|patients?|clients?|staff|employees?|students?|members?|teams?|clinics?|locations?|years?|grants?|volunteers?|families|schools?|classes?|stores?|branches?|countries|states|cities|audits?|wards?|beds?|cases?";

/**
 * "three programs" and "six years" carry the same weight as "3 programs" but
 * spell the number, so a digit-only check silently lets an invented scope
 * through. Only number words next to a scope noun are treated as claims, which
 * keeps ordinary prose ("one of the clinics") from being flagged.
 */
const SPELLED_SCOPE_CLAIM = new RegExp(
  `\\b(${NUMBER_WORD_PATTERN})\\s+(?:[a-z-]+\\s+)?(${SCOPE_NOUNS})\\b`,
  "gi",
);

function spelledScopeClaims(text: string): Array<{ phrase: string; digit: string }> {
  const found: Array<{ phrase: string; digit: string }> = [];
  for (const match of text.matchAll(SPELLED_SCOPE_CLAIM)) {
    const digit = NUMBER_WORDS[match[1].toLowerCase()];
    if (digit) found.push({ phrase: match[0].replace(/\s+/g, " ").trim(), digit });
  }
  return found;
}

/** Every number the corpus contains, digit or word, for exact comparison. */
function numberSet(text: string): Set<string> {
  const set = new Set<string>();
  for (const match of text.matchAll(/\b\d[\d,.]*\b/g)) set.add(match[0].replace(/[.,]/g, ""));
  for (const match of text.matchAll(new RegExp(`\\b(${NUMBER_WORD_PATTERN})\\b`, "gi"))) {
    const digit = NUMBER_WORDS[match[1].toLowerCase()];
    if (digit) set.add(digit);
  }
  return set;
}

function claims(text: string): string[] {
  const found = text.match(CLAIM_PATTERN) ?? [];
  return found
    .map((claim) => claim.replace(/,/g, ""))
    .filter((claim) => /\d{2,}/.test(claim) || claim.includes("%") || claim.endsWith("+"));
}

function profileCorpus(profile: ProfileData): string {
  const parts: string[] = [
    profile.identity.fullName,
    profile.identity.location,
    profile.headline,
    profile.summary,
    ...Object.values(profile.positioning),
    ...profile.doNotClaim,
    profile.notes,
  ];

  for (const section of profile.sections) {
    parts.push(section.title, section.text);
    for (const entry of section.entries) {
      parts.push(
        entry.heading,
        entry.subheading,
        entry.location,
        entry.start,
        entry.end,
        entry.summary,
        entry.link,
        ...entry.tags,
        ...entry.bullets.map((bullet) => bullet.text),
      );
    }
    for (const group of section.groups) {
      parts.push(group.label, ...group.items);
    }
  }

  return parts.join("\n").toLowerCase().replace(/,/g, "");
}

export function findClaimWarnings(profile: ProfileData, result: TailorResult): string[] {
  const texts: string[] = [result.document.summary];

  for (const entry of result.document.entries) {
    for (const bullet of entry.bullets) texts.push(bullet.text);
  }
  for (const section of result.document.groups) {
    for (const group of section.groups) texts.push(group.label, ...group.items);
  }
  for (const section of result.document.texts) texts.push(section.text);

  return findTextWarnings(profile, texts);
}

/** Numbers, "do not claim" hits, and similar checks for any free text. */
export function findTextWarnings(profile: ProfileData, texts: string[]): string[] {
  const corpus = profileCorpus(profile);
  const warnings = new Set<string>();

  const numbers = numberSet(corpus);

  for (const text of texts) {
    for (const claim of claims(text)) {
      if (!corpus.includes(claim.toLowerCase())) {
        warnings.add(`“${claim}” is not in your career memory. Check it before sending.`);
      }
    }
    for (const claim of spelledScopeClaims(text)) {
      if (!numbers.has(claim.digit)) {
        warnings.add(`“${claim.phrase}” is not in your career memory. Check it before sending.`);
      }
    }
  }

  for (const banned of profile.doNotClaim) {
    const needle = banned.trim().toLowerCase();
    if (needle.length < 4) continue;
    if (texts.some((text) => text.toLowerCase().includes(needle))) {
      warnings.add(`This draft uses something on your “do not claim” list: “${banned}”.`);
    }
  }

  return [...warnings].slice(0, 12);
}

/**
 * The phrases that make a cover letter read as machine-written. Kept short and
 * specific: every entry here has been seen so often that it stops being read.
 */
export const SLOP_PHRASES = [
  "i am writing to",
  "i am excited to",
  "i am thrilled",
  "i would be thrilled",
  "i am passionate",
  "passionate about",
  "dream job",
  "perfect fit",
  "perfect candidate",
  "proven track record",
  "hit the ground running",
  "team player",
  "leverage my",
  "leverage the",
  "synergy",
  "synergies",
  "dynamic environment",
  "robust solution",
  "seamless",
  "cutting-edge",
  "cutting edge",
  "in today's fast-paced",
  "in today’s fast-paced",
  "i believe that",
  "aligns perfectly",
  "aligns with my",
  "value-add",
  "results-driven",
  "detail-oriented",
  "self-starter",
  "go-getter",
  "wear many hats",
  "think outside the box",
  "delve",
  "tapestry",
  "testament to",
  "in the realm of",
  "ever-evolving landscape",
  "the landscape of",
  "my journey",
  "resonates with me",
  "holistic",
  "world-class",
  "wealth of experience",
  "caught my attention",
  "what drew me",
  "drew me to",
  "immediately drawn",
  "is why i am applying",
  "the posting describes",
  "your job description",
  "the role calls for",
  "welcome the chance to discuss",
  "i have long admired",
  "i have always admired",
  "your innovative",
  "your esteemed",
  "at your earliest convenience",
  "i look forward to hearing from you",
  "thank you for considering my application",
  "please do not hesitate",
  "it is with great pleasure",
  "i am confident that",
  "i am eager to",
  "eager to support",
  "in my previous",
  "at my last",
  "in my last",
  "my previous role",
  "my current position",
  "i look forward to",
  "uniquely positioned",
  "esteemed organization",
  "esteemed organisation",
] as const;

/** Openers that announce the letter instead of starting it. */
export const SLOP_OPENERS = [
  "i am writing",
  "i am applying",
  "i wish to apply",
  "please accept this letter",
  "please accept my application",
  "as a seasoned",
  "as an experienced",
  "with over",
  "with more than",
  "my name is",
] as const;

export function findSlopWarnings(texts: string[]): string[] {
  const body = texts.join("\n").toLowerCase();
  const warnings = new Set<string>();

  for (const phrase of SLOP_PHRASES) {
    if (body.includes(phrase)) warnings.add(`“${phrase}” is a template phrase. Rewrite that line in your own words.`);
  }

  const opener = (texts[0] ?? "").trim().toLowerCase();
  for (const phrase of SLOP_OPENERS) {
    if (opener.startsWith(phrase)) {
      warnings.add(`The letter opens with “${phrase}”. Start with something only you could write.`);
    }
  }

  return [...warnings].slice(0, 8);
}

export function atsWarnings(pageCount: number, atsText: string, target: number): string[] {
  const warnings: string[] = [];
  // A CV that spills onto a second page is normal, not a defect: the layout is
  // not forced to one page. Say so plainly instead of reporting a failure.
  if (pageCount > target) {
    warnings.push(
      `This CV runs to ${pageCount} pages against a ${target}-page target. That is fine when the extra page carries real content; cut anything that is not earning its place.`,
    );
  }
  if (atsText.length < 300) {
    warnings.push(
      "This CV has very little text because the memory is thin. Add roles, dates, and results to the memory so recruiters and ATS software have something to read.",
    );
  }
  return warnings;
}
