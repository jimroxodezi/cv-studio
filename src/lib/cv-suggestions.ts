import type { ProfileData, ProfileEntry, ProfileSuggestion } from "@/lib/profile";
import { sectionHasContent } from "@/lib/profile";

const PRIORITY_ORDER: Record<ProfileSuggestion["priority"], number> = {
  high: 0,
  medium: 1,
  low: 2,
};

const EDUCATION_PATTERN =
  /educat|qualif|degree|academic|training|apprentic|school|college|university/i;
const CREDENTIAL_PATTERN = /licen[cs]e|certificat|registration|accredit|board/i;
const SKILLS_PATTERN = /skill|competenc|expertise|technical|tools|language/i;
const EMPLOYER_PATTERN = /experience|employment|work|career|placement|rotation|clinical|teaching|practice/i;

function clean(value: string, max = 70): string {
  const trimmed = value.replace(/\s+/g, " ").trim();
  return trimmed.length > max ? `${trimmed.slice(0, max - 1)}…` : trimmed;
}

function hasNumber(text: string): boolean {
  return /\d/.test(text);
}

/**
 * Turns what is missing from the memory into concrete asks. Every item is
 * information the candidate has to supply themselves — this function never
 * proposes content, values, or achievements.
 */
export function profileSuggestions(profile: ProfileData): ProfileSuggestion[] {
  const suggestions: ProfileSuggestion[] = [];
  const seen = new Set<string>();

  function add(priority: ProfileSuggestion["priority"], area: string, text: string) {
    const key = text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (seen.has(key)) return;
    seen.add(key);
    suggestions.push({ priority, area, text });
  }

  const entries: ProfileEntry[] = profile.sections.flatMap((section) =>
    section.kind === "entries" ? section.entries : [],
  );
  const groups = profile.sections.flatMap((section) => (section.kind === "groups" ? section.groups : []));
  const hasContent = profile.sections.some(sectionHasContent);

  if (!profile.identity.fullName.trim() || profile.identity.fullName === "Your name") {
    add("high", "Name", "Enter your full name exactly as it should appear on the CV.");
  }
  if (!profile.identity.phone.trim()) {
    add("high", "Contact", "Add a phone number recruiters can reach you on.");
  }
  if (!profile.identity.location.trim()) {
    add("medium", "Contact", "Add your city and country — many postings filter on location.");
  }
  if (!profile.identity.linkedin.trim() && !profile.identity.website.trim()) {
    add("low", "Contact", "Add a LinkedIn profile or portfolio link if you have one.");
  }

  if (!profile.headline.trim()) {
    add("medium", "Headline", "Add a one-line headline naming the role you are targeting.");
  }
  if (!profile.summary.trim() && !Object.values(profile.positioning).some((value) => value.trim())) {
    add(
      "high",
      "Summary",
      "Add a 2–3 sentence summary: your field, how many years of experience you have, and what you are known for.",
    );
  }

  if (!hasContent) {
    add(
      "high",
      "History",
      "Add at least one role, placement, qualification, or skill. A CV can only show what you put in the memory.",
    );
  } else if (!entries.length) {
    add(
      "high",
      "History",
      "Add your work history: a title, employer, dates, and 2–3 results for each role or placement.",
    );
  }

  const hasEducation = profile.sections.some(
    (section) => EDUCATION_PATTERN.test(section.title) && sectionHasContent(section),
  );
  if (!hasEducation) {
    add(
      "high",
      "Education",
      "Add a section for your education or training: qualification, institution, and year.",
    );
  }

  const hasCredential = profile.sections.some(
    (section) => CREDENTIAL_PATTERN.test(section.title) && sectionHasContent(section),
  );
  if (!hasCredential) {
    add(
      "medium",
      "Credentials",
      "Add any licence, registration, or certification you hold, with the issuing body and year.",
    );
  }

  const hasSkills = groups.some((group) => group.items.length) || profile.sections.some(
    (section) => SKILLS_PATTERN.test(section.title) && sectionHasContent(section),
  );
  if (!hasSkills) {
    add(
      "medium",
      "Skills",
      "Add a skills section with the tools, methods, systems, and languages you actually use.",
    );
  }

  let missingDates = 0;
  let missingEmployer = 0;
  let missingBullets = 0;
  let thinBullets = 0;
  let openEnded = 0;

  for (const entry of entries) {
    if (entry.heading.trim()) {
      const label = clean(entry.heading);
      const inEmploymentSection = profile.sections.some(
        (section) =>
          section.kind === "entries" &&
          section.entries.some((item) => item.id === entry.id) &&
          EMPLOYER_PATTERN.test(section.title),
      );

      if (!entry.start.trim() && !entry.end.trim() && !entry.current) {
        missingDates += 1;
        if (missingDates <= 2) {
          add("high", "Dates", `Add the dates you held “${label}” — month and year are enough.`);
        }
      } else if (entry.start.trim() && !entry.end.trim() && !entry.current) {
        openEnded += 1;
        if (openEnded <= 2) {
          add("medium", "Dates", `Is “${label}” your current role? Tick “Current” or add an end date.`);
        }
      }

      if (inEmploymentSection && !entry.subheading.trim()) {
        missingEmployer += 1;
        if (missingEmployer <= 2) {
          add("high", "Employer", `Add the employer or organisation for “${label}”.`);
        }
      }

      if (!entry.bullets.some((bullet) => bullet.text.trim())) {
        missingBullets += 1;
        if (missingBullets <= 3) {
          add(
            "high",
            "Evidence",
            `Add 2–3 bullet points for “${label}”: what you did, the scale, and the result.`,
          );
        }
      } else if (entry.bullets.filter((bullet) => bullet.text.trim()).length < 2) {
        thinBullets += 1;
        if (thinBullets <= 2) {
          add("medium", "Evidence", `Add one or two more results for “${label}”.`);
        }
      }
    }
  }

  if (missingDates > 2) {
    add("high", "Dates", `Add dates to the other ${missingDates - 2} roles that still have none.`);
  }
  if (missingBullets > 3) {
    add(
      "medium",
      "Evidence",
      `Add bullet points to ${missingBullets - 3} more of your roles so every entry has evidence.`,
    );
  }

  const bulletTexts = entries.flatMap((entry) => entry.bullets.map((bullet) => bullet.text));
  if (bulletTexts.length && !bulletTexts.some(hasNumber)) {
    add(
      "medium",
      "Evidence",
      "Where you can, put numbers in your bullets — people served, caseload, class size, budget, or time saved.",
    );
  }

  return suggestions
    .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])
    .slice(0, 9);
}

const STOP_WORDS = new Set([
  "this", "that", "your", "yours", "with", "from", "have", "has", "had", "what", "when",
  "where", "will", "would", "they", "them", "their", "there", "about", "into", "more",
  "most", "some", "such", "than", "then", "only", "also", "just", "very", "each", "other",
  "over", "under", "again", "once", "here", "there", "both", "few", "nor", "not", "now",
  "same", "too", "can", "did", "does", "doing", "down", "during", "before", "after",
  "above", "below", "between", "against", "further", "add", "give", "include", "list",
]);

function significantWords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length >= 4 && !STOP_WORDS.has(word)),
  );
}

function overlaps(a: Set<string>, b: Set<string>): boolean {
  let shared = 0;
  for (const word of a) {
    if (b.has(word)) {
      shared += 1;
      if (shared >= 2) return true;
    }
  }
  return false;
}

/**
 * Combines deterministic checks with asks the import model noticed. Model text
 * is treated as untrusted advice only; it is never applied to the profile.
 */
export function mergeSuggestions(
  profile: ProfileData,
  extra: unknown,
): ProfileSuggestion[] {
  const merged = profileSuggestions(profile);
  const seen = new Set(merged.map((item) => item.text.toLowerCase()));
  const keywords = merged.map((item) => significantWords(item.text));

  const items = Array.isArray(extra) ? extra : [];
  let added = 0;
  for (const item of items) {
    if (added >= 3) break;
    if (typeof item !== "string") continue;
    const text = item.trim();
    if (!text || text.length > 300) continue;
    // Example lists inside an ask are usually the model suggesting facts it
    // invented. Keep only category-level asks.
    if (/\b(such as|e\.g\.|for example|including)\b/i.test(text)) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;

    // The model often restates a check that is already covered. Keep only the
    // asks that add something the deterministic pass missed.
    const words = significantWords(text);
    if (keywords.some((existing) => overlaps(existing, words))) continue;

    seen.add(key);
    keywords.push(words);
    merged.push({ priority: "medium", area: "From the import", text });
    added += 1;
  }

  return merged.slice(0, 12);
}
