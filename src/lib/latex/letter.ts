import type { CoverLetter, Identity } from "@/lib/profile";
import { escapeLatex } from "@/lib/latex/render";

export type { CoverLetter };

export const EMPTY_LETTER: CoverLetter = {
  subject: "",
  greeting: "",
  paragraphs: [],
  closing: "Sincerely,",
  angle: "",
  structure: "",
  evidence: [],
  notes: "",
};

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** "2026-11-17" to "17 November 2026". Falls back to the input. */
export function letterDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
  if (!match) return iso;
  const [, year, month, day] = match;
  const name = MONTHS[Number(month) - 1] ?? "";
  if (!name) return iso;
  return `${Number(day)} ${name} ${year}`;
}

const SEP = " \\enspace\\textbullet\\enspace ";

function contactLine(identity: Identity): string {
  return [identity.email, identity.phone, identity.location]
    .filter(Boolean)
    .map(escapeLatex)
    .join(SEP);
}

/** Links sit on their own line so a long URL cannot strand a separator. */
function linksLine(identity: Identity): string {
  return [identity.website, identity.linkedin]
    .filter(Boolean)
    .map((value) => escapeLatex(value.replace(/^https?:\/\//, "").replace(/\/$/, "")))
    .join(SEP);
}

export function renderCoverLetter(options: {
  identity: Identity;
  company: string;
  role: string;
  /** ISO date, so a rebuild keeps the date it was written. */
  date: string;
  letter: CoverLetter;
}): string {
  const { identity, company, role, letter } = options;
  const subject =
    letter.subject.trim() ||
    (role.trim() ? `Application for ${role.trim()}` : "Application for this role");
  const greeting = letter.greeting.trim() || "Dear Hiring Team,";
  const closing = letter.closing.trim() || "Sincerely,";
  const paragraphs = letter.paragraphs.map((entry) => entry.trim()).filter(Boolean);
  const recipient = company.trim() || "Hiring Manager";

  const lines: string[] = [
    `\\letterhead{${escapeLatex(identity.fullName)}}{${contactLine(identity)}}{${linksLine(identity)}}`,
    `\\letterdate{${escapeLatex(letterDate(options.date))}}`,
    `\\letterto{${escapeLatex(recipient)}}{}`,
    `\\lettersubject{${escapeLatex(subject)}}`,
    `\\letteropening{${escapeLatex(greeting)}}`,
  ];

  for (const paragraph of paragraphs) lines.push(escapeLatex(paragraph));

  lines.push(`\\letterclosing{${escapeLatex(closing)}}{${escapeLatex(identity.fullName)}}`);
  return lines.join("\n\n") + "\n";
}
