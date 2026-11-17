import type { Education, Experience, Identity, Project, SectionKey, SkillGroup } from "@/lib/profile";

export type CvDocument = {
  identity: Identity;
  summary: string;
  skills: SkillGroup[];
  experience: Experience[];
  projects: Project[];
  education: Education[];
  sectionOrder: SectionKey[];
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

function header(identity: Identity): string {
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
  if (contact.length) lines.push(`  \\\\[3pt] ${contact.join(" \\quad|\\quad ")}`);
  if (links.length) lines.push(`  \\\\[2pt] ${links.join(" \\quad|\\quad ")}`);
  lines.push("\\end{center}");
  return lines.join("\n");
}

function section(title: string, body: string): string {
  return `\\cvsection{${title}}\n${body}`.trimEnd();
}

export function renderBody(doc: CvDocument): string {
  const blocks: string[] = [header(doc.identity)];

  for (const key of doc.sectionOrder) {
    if (key === "summary") {
      const summary = doc.summary.trim();
      if (summary) blocks.push(section("Summary", escapeLatex(summary)));
      continue;
    }

    if (key === "skills") {
      if (!doc.skills.length) continue;
      const lines = doc.skills
        .filter((group) => group.items.length)
        .map((group) => `\\cvskill{${escapeLatex(group.label)}}{${group.items.map(escapeLatex).join(", ")}}`);
      if (lines.length) blocks.push(section("Technical Skills", lines.join("\n")));
      continue;
    }

    if (key === "experience") {
      if (!doc.experience.length) continue;
      const entries = doc.experience.map((entry) => {
        const dates = dateRange(entry.start, entry.end, entry.current);
        const bullets = entry.bullets
          .filter((bullet) => bullet.text.trim())
          .map((bullet) => `    \\item ${escapeLatex(bullet.text)}`)
          .join("\n");
        return [
          `  \\begin{cvjob}{${escapeLatex(entry.company)}}{${escapeLatex(entry.location)}}{${escapeLatex(entry.role)}}{${escapeLatex(dates)}}`,
          bullets,
          "  \\end{cvjob}",
        ]
          .filter(Boolean)
          .join("\n");
      });
      blocks.push(section("Experience", `\\begin{itemize}\n${entries.join("\n")}\n\\end{itemize}`));
      continue;
    }

    if (key === "projects") {
      if (!doc.projects.length) continue;
      const entries = doc.projects.map((entry) => {
        const bullets = entry.bullets
          .filter((bullet) => bullet.text.trim())
          .map((bullet) => `    \\item ${escapeLatex(bullet.text)}`)
          .join("\n");
        return [
          `  \\begin{cvproject}{${escapeLatex(entry.name)}}{${escapeLatex(entry.stack)}}`,
          bullets,
          "  \\end{cvproject}",
        ]
          .filter(Boolean)
          .join("\n");
      });
      blocks.push(section("Selected Projects", `\\begin{itemize}\n${entries.join("\n")}\n\\end{itemize}`));
      continue;
    }

    if (key === "education") {
      if (!doc.education.length) continue;
      const lines = doc.education.map((entry) => {
        const dates = dateRange(entry.start, entry.end, false);
        const where = [entry.institution, entry.location].filter(Boolean).join(", ");
        return `\\cvedu{${escapeLatex(entry.degree)}}{${escapeLatex(where)}${dates ? ` --- ${escapeLatex(dates)}` : ""}}`;
      });
      blocks.push(section("Education", lines.join("\n")));
    }
  }

  return `${blocks.join("\n\n")}\n`;
}
