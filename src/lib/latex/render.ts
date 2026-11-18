import type { Identity, ProfileEntry, ProfileGroup } from "@/lib/profile";

export type CvSection =
  | { id: string; title: string; kind: "entries"; entries: ProfileEntry[] }
  | { id: string; title: string; kind: "groups"; groups: ProfileGroup[] }
  | { id: string; title: string; kind: "text"; text: string };

export type CvDocument = {
  identity: Identity;
  summary: string;
  /** Printed under the name only when there is no summary to lead with. */
  headline?: string;
  sections: CvSection[];
};

const ESCAPES: Record<string, string> = {
  "\\": "\\textbackslash{}",
  "&": "\\&",
  "%": "\\%",
  $: "\\$",
  "#": "\\#",
  _: "\\_",
  "{": "\\{",
  "}": "\\}",
  "~": "\\textasciitilde{}",
  "^": "\\textasciicircum{}",
};

export function escapeLatex(value: string): string {
  return value.replace(/[\\&%$#_{}~^]/g, (char) => ESCAPES[char] ?? char);
}

function safeUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    return encodeURI(new URL(withScheme).toString()).replace(/~/g, "%7E");
  } catch {
    return "";
  }
}

function latexUrl(value: string): string {
  return safeUrl(value).replace(/[%#&_{}~]/g, (char) => `\\${char}`);
}

function link(url: string, label: string): string {
  const href = latexUrl(url);
  return href ? `\\href{${href}}{${escapeLatex(label)}}` : escapeLatex(label);
}

/**
 * A recruiter reads "bechiq" or "alx_africa" as a typo, not as a brand. Only a
 * name stored entirely in lowercase is touched, so deliberate mixed case such
 * as "dbFailsim" or "eBay" survives the fix; the rest of the name is never
 * rewritten.
 */
function capitaliseName(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || trimmed !== trimmed.toLocaleLowerCase()) return trimmed;
  return trimmed.charAt(0).toLocaleUpperCase() + trimmed.slice(1);
}

function dateRange(start: string, end: string, current: boolean): string {
  const final = current ? "Present" : end;
  return [start, final].filter(Boolean).join(" -- ");
}

/** "https://example.com/" -> "example.com", so the label carries the meaning. */
function prettyUrl(value: string): string {
  return value.replace(/^https?:\/\//i, "").replace(/\/$/, "");
}

function header(identity: Identity, headline: string): string {
  // One labelled line under the name: "Email: …, Website: …, Phone: …".
  // Labels make a recruiter's eye skip straight to the field it wants, and
  // every field is optional, so the line matches whatever the memory holds.
  const details: string[] = [];
  const field = (label: string, value: string) => `\\cvfield{${label}}{${value}}`;
  if (identity.email) details.push(field("Email", link(`mailto:${identity.email}`, identity.email)));
  if (identity.website) details.push(field("Website", link(identity.website, prettyUrl(identity.website))));
  if (identity.phone) details.push(field("Phone", escapeLatex(identity.phone)));
  if (identity.location) details.push(field("Location", escapeLatex(identity.location)));
  if (identity.linkedin) details.push(field("LinkedIn", link(identity.linkedin, prettyUrl(identity.linkedin))));
  if (identity.github) details.push(field("GitHub", link(identity.github, prettyUrl(identity.github))));
  if (identity.x) details.push(field("X", link(identity.x, prettyUrl(identity.x))));

  // Typography lives in the preamble; the renderer only supplies the parts.
  return `\\cvheader{${escapeLatex(identity.fullName)}}{${escapeLatex(headline.trim())}}{${details.join(", ")}}{}`;
}

function section(title: string, body: string): string {
  return `\\cvsection{${escapeLatex(title)}}\n${body}`.trimEnd();
}

function entryBody(entry: ProfileEntry): string {
  const dates = dateRange(entry.start, entry.end, entry.current);
  const subheading = [
    escapeLatex(capitaliseName(entry.subheading)),
    entry.link ? link(entry.link, entry.link.replace(/^https?:\/\//, "")) : "",
  ]
    .filter(Boolean)
    .join(" \\quad ");
  const bullets = entry.bullets
    .filter((bullet) => bullet.text.trim())
    .map((bullet) => `    \\item ${escapeLatex(bullet.text)}`)
    .join("\n");
  const bulletBlock = bullets ? `  \\begin{subitems}\n${bullets}\n  \\end{subitems}` : "";

  return [
    `  \\cventry{${escapeLatex(capitaliseName(entry.heading))}}{${subheading}}{${escapeLatex(entry.location)}}{${escapeLatex(dates)}}`,
    bulletBlock,
  ]
    .filter(Boolean)
    .join("\n");
}

export function renderBody(doc: CvDocument): string {
  const summary = doc.summary.trim();
  const blocks: string[] = [header(doc.identity, summary ? "" : doc.headline ?? "")];

  if (summary) blocks.push(section("Summary", escapeLatex(summary)));

  for (const item of doc.sections) {
    if (item.kind === "text") {
      if (item.text.trim()) blocks.push(section(item.title, escapeLatex(item.text)));
      continue;
    }

    if (item.kind === "groups") {
      const lines = item.groups
        .filter((group) => group.items.length)
        .map(
          (group) =>
            `\\cvskill{${escapeLatex(group.label)}}{${group.items.map(escapeLatex).join(", ")}}`,
        );
      if (lines.length) blocks.push(section(item.title, lines.join("\n")));
      continue;
    }

    const entries = item.entries.filter((entry) => entry.heading.trim());
    if (entries.length) {
      const body = `\\begin{entrylist}\n${entries.map(entryBody).join("\n")}\n\\end{entrylist}`;
      blocks.push(section(item.title, body));
    }
  }

  return `${blocks.join("\n\n")}\n`;
}
