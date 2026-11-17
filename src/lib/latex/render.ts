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

function dateRange(start: string, end: string, current: boolean): string {
  const final = current ? "Present" : end;
  return [start, final].filter(Boolean).join(" -- ");
}

function header(identity: Identity, headline: string): string {
  const contact: string[] = [];
  if (identity.email) contact.push(link(`mailto:${identity.email}`, identity.email));
  if (identity.phone) contact.push(escapeLatex(identity.phone));
  if (identity.location) contact.push(escapeLatex(identity.location));
  const links: string[] = [];
  if (identity.website) links.push(link(identity.website, identity.website.replace(/^https?:\/\//, "").replace(/\/$/, "")));
  if (identity.github) links.push(link(identity.github, identity.github.replace(/^https?:\/\//, "").replace(/\/$/, "")));
  if (identity.linkedin) links.push(link(identity.linkedin, "linkedin"));
  if (identity.x) links.push(link(identity.x, identity.x.replace(/^https?:\/\//, "").replace(/\/$/, "")));

  const lines = [
    "\\begin{center}",
    `  {\\LARGE \\textbf{${escapeLatex(identity.fullName)}}}`,
  ];
  if (headline.trim()) lines.push(`  \\\\[2pt] \\textit{${escapeLatex(headline.trim())}}`);
  if (contact.length) lines.push(`  \\\\[3pt] ${contact.join(" \\quad|\\quad ")}`);
  if (links.length) lines.push(`  \\\\[2pt] ${links.join(" \\quad|\\quad ")}`);
  lines.push("\\end{center}");
  return lines.join("\n");
}

function section(title: string, body: string): string {
  return `\\cvsection{${escapeLatex(title)}}\n${body}`.trimEnd();
}

function entryBody(entry: ProfileEntry): string {
  const dates = dateRange(entry.start, entry.end, entry.current);
  const subheading = [
    escapeLatex(entry.subheading),
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
    `  \\cventry{${escapeLatex(entry.heading)}}{${subheading}}{${escapeLatex(entry.location)}}{${escapeLatex(dates)}}`,
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
      const body = `\\begin{itemize}\n${entries.map(entryBody).join("\n")}\n\\end{itemize}`;
      blocks.push(section(item.title, body));
    }
  }

  return `${blocks.join("\n\n")}\n`;
}
