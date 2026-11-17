import type { ProfileData, TailorResult } from "@/lib/profile";

const CLAIM_PATTERN = /\b\d[\d,.]*(?:\+|%|k|K)?\b/g;

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
  for (const group of profile.skillGroups) parts.push(group.label, ...group.items);
  for (const entry of profile.experience) {
    parts.push(
      entry.company,
      entry.location,
      entry.role,
      entry.start,
      entry.end,
      entry.summary,
      ...entry.bullets.map((bullet) => bullet.text),
    );
  }
  for (const entry of profile.projects) {
    parts.push(entry.name, entry.stack, ...entry.bullets.map((bullet) => bullet.text));
  }
  for (const entry of profile.education) {
    parts.push(entry.degree, entry.institution, entry.start, entry.end, entry.details);
  }
  return parts.join("\n").toLowerCase().replace(/,/g, "");
}

export function findClaimWarnings(profile: ProfileData, result: TailorResult): string[] {
  const corpus = profileCorpus(profile);
  const warnings = new Set<string>();
  const texts: string[] = [result.document.summary];
  for (const group of result.document.skills) texts.push(group.label, ...group.items);
  for (const entry of [...result.document.experience, ...result.document.projects]) {
    for (const bullet of entry.bullets) texts.push(bullet.text);
  }

  for (const text of texts) {
    for (const claim of claims(text)) {
      if (!corpus.includes(claim.toLowerCase())) {
        warnings.add(`“${claim}” is not in your career memory. Check it before sending.`);
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

export function atsWarnings(pageCount: number, atsText: string, target: number): string[] {
  const warnings: string[] = [];
  if (pageCount > target) warnings.push(`This CV is ${pageCount} pages; your target is ${target}.`);
  if (atsText.length < 300) warnings.push("Very little text could be extracted from the PDF. Check the layout.");
  return warnings;
}
