import { z } from "zod";

type Loose = Record<string, unknown>;

function record(value: unknown): Loose {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Loose) : {};
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function str(value: unknown, max = 1000): string {
  return typeof value === "string" ? value.slice(0, max).trim() : "";
}

function strArray(value: unknown, maxItems = 60, maxLength = 200): string[] {
  return array(value)
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().slice(0, maxLength))
    .filter(Boolean)
    .slice(0, maxItems);
}

export const bulletSchema = z.object({
  id: z.string().min(1).max(120),
  text: z.string().min(1).max(1200),
});

export const identitySchema = z.object({
  fullName: z.string().min(1).max(120),
  email: z.string().email().max(200),
  phone: z.string().max(60).optional().default(""),
  location: z.string().max(160).optional().default(""),
  website: z.string().max(300).optional().default(""),
  github: z.string().max(300).optional().default(""),
  linkedin: z.string().max(300).optional().default(""),
  x: z.string().max(300).optional().default(""),
});

/** One row in any CV section: a job, degree, project, award, publication, etc. */
export const entrySchema = z.object({
  id: z.string().min(1).max(120),
  heading: z.string().min(1).max(200),
  subheading: z.string().max(200).default(""),
  location: z.string().max(160).default(""),
  start: z.string().max(40).default(""),
  end: z.string().max(40).default(""),
  current: z.boolean().default(false),
  summary: z.string().max(1000).default(""),
  link: z.string().max(400).default(""),
  bullets: z.array(bulletSchema).max(20).default([]),
  tags: z.array(z.string().max(60)).max(20).default([]),
});

/** A compact line of labelled items: "Languages: English, German". */
export const groupSchema = z.object({
  id: z.string().min(1).max(120),
  label: z.string().min(1).max(80),
  items: z.array(z.string().min(1).max(120)).max(40).default([]),
});

export const sectionKindSchema = z.enum(["entries", "groups", "text"]);

/**
 * A CV section is user-defined. The title is whatever fits the profession
 * ("Experience", "Clinical Rotations", "Publications"), and the kind decides
 * how its content is rendered.
 */
export const profileSectionSchema = z.object({
  id: z.string().min(1).max(80),
  title: z.string().min(1).max(80),
  kind: sectionKindSchema.default("entries"),
  entries: z.array(entrySchema).max(40).default([]),
  groups: z.array(groupSchema).max(20).default([]),
  text: z.string().max(4000).default(""),
});

export const profileDataSchema = z.object({
  identity: identitySchema,
  headline: z.string().max(240).default(""),
  summary: z.string().max(2000).default(""),
  positioning: z.record(z.string(), z.string().max(1200)).default({}),
  sections: z.array(profileSectionSchema).max(30).default([]),
  doNotClaim: z.array(z.string().max(300)).max(50).default([]),
  notes: z.string().max(20000).default(""),
});

export type Bullet = z.infer<typeof bulletSchema>;
export type Identity = z.infer<typeof identitySchema>;
export type ProfileEntry = z.infer<typeof entrySchema>;
export type ProfileGroup = z.infer<typeof groupSchema>;
export type SectionKind = z.infer<typeof sectionKindSchema>;
export type ProfileSection = z.infer<typeof profileSectionSchema>;
export type ProfileData = z.infer<typeof profileDataSchema>;

export function sectionHasContent(section: ProfileSection): boolean {
  if (section.kind === "text") return Boolean(section.text.trim());
  if (section.kind === "groups") return section.groups.some((group) => group.items.length);
  return section.entries.length > 0;
}

export function profileHasContent(profile: ProfileData): boolean {
  return profile.sections.some(sectionHasContent);
}

export function sectionEntryIds(section: ProfileSection): string[] {
  if (section.kind === "groups") return section.groups.map((group) => group.id);
  if (section.kind === "text") return [];
  return section.entries.map((entry) => entry.id);
}

export function allSectionEntryIds(profile: ProfileData): string[] {
  return profile.sections.flatMap(sectionEntryIds);
}

export function countEntries(profile: ProfileData): number {
  return profile.sections.reduce(
    (total, section) => total + (section.kind === "entries" ? section.entries.length : 0),
    0,
  );
}

export const variantOptionsSchema = z.object({
  pageTarget: z.union([z.literal(1), z.literal(2)]).default(1),
});

export const variantDataSchema = z.object({
  name: z.string().min(1).max(120),
  track: z.string().min(1).max(60),
  summary: z.string().max(2000).default(""),
  /** Profile section ids, in the order they should appear. */
  sectionIds: z.array(z.string().max(80)).max(30).default([]),
  /** Selected entry or group ids across all sections. */
  entryIds: z.array(z.string().max(120)).max(400).default([]),
  options: variantOptionsSchema.default({ pageTarget: 1 }),
});

export type VariantData = z.infer<typeof variantDataSchema>;

export const jobAnalysisSchema = z.object({
  track: z.string().max(60).default("general"),
  seniority: z.string().max(80).default(""),
  keywords: z.array(z.string().max(120)).max(60).default([]),
  requirements: z.array(z.string().max(300)).max(40).default([]),
  gaps: z.array(z.string().max(300)).max(40).default([]),
  angle: z.string().max(1000).default(""),
});

export type JobAnalysis = z.infer<typeof jobAnalysisSchema>;

export const generatedBulletSchema = z.object({
  text: z.string().min(1).max(1200),
  sourceBulletIds: z.array(z.string()).default([]),
});

export const tailoredDocumentSchema = z.object({
  summary: z.string().max(2000).default(""),
  sectionOrder: z.array(z.string().max(80)).max(30).default([]),
  entries: z
    .array(
      z.object({
        entryId: z.string().min(1).max(120),
        bullets: z.array(generatedBulletSchema).max(12).default([]),
      }),
    )
    .max(60)
    .default([]),
  groups: z
    .array(
      z.object({
        sectionId: z.string().min(1).max(80),
        groups: z
          .array(
            z.object({
              label: z.string().min(1).max(80),
              items: z.array(z.string().min(1).max(120)).max(40).default([]),
            }),
          )
          .max(20)
          .default([]),
      }),
    )
    .max(20)
    .default([]),
  texts: z
    .array(
      z.object({
        sectionId: z.string().min(1).max(80),
        text: z.string().max(4000).default(""),
      }),
    )
    .max(20)
    .default([]),
});

export type TailoredDocument = z.infer<typeof tailoredDocumentSchema>;

export const tailorResultSchema = z.object({
  analysis: jobAnalysisSchema,
  document: tailoredDocumentSchema,
  keywordCoverage: z
    .array(
      z.object({
        keyword: z.string().max(120),
        evidence: z.string().max(500).default(""),
        where: z.string().max(160).default(""),
      }),
    )
    .max(60)
    .default([]),
  gaps: z.array(z.string().max(300)).max(40).default([]),
  notes: z.string().max(4000).default(""),
});

export type TailorResult = z.infer<typeof tailorResultSchema>;

/**
 * A cover letter kept as text, so it stays editable and can be recompiled
 * without another model call. The internal fields are never printed.
 */
export const coverLetterSchema = z.object({
  subject: z.string().max(200).default(""),
  greeting: z.string().max(160).default(""),
  paragraphs: z.array(z.string().min(1).max(2000)).min(1).max(8),
  closing: z.string().max(60).default("Sincerely,"),
  // The fields below are internal notes. A model that rambles about its own
  // strategy must never fail a generation over them, so they are truncated
  // rather than validated.
  /** Why this letter works, for the candidate to judge. Not printed. */
  angle: z.string().default("").transform((value) => value.slice(0, 800)),
  /** Which structure the letter uses, so consecutive letters can differ. */
  structure: z.string().default("").transform((value) => value.slice(0, 160)),
  /** The memory facts the letter leans on. Not printed. */
  evidence: z
    .array(z.string().transform((value) => value.slice(0, 400)))
    .max(12)
    .default([]),
  /** What was deliberately left out, and why. Not printed. */
  notes: z.string().default("").transform((value) => value.slice(0, 2000)),
});

export type CoverLetter = z.infer<typeof coverLetterSchema>;

/** Editable fields only: what a rebuild accepts from the browser. */
export const coverLetterEditSchema = coverLetterSchema.pick({
  subject: true,
  greeting: true,
  paragraphs: true,
  closing: true,
});

export type CoverLetterEdit = z.infer<typeof coverLetterEditSchema>;

export const suggestionPrioritySchema = z.enum(["high", "medium", "low"]);

/** An ask for information the candidate has to supply. Never generated facts. */
export const profileSuggestionSchema = z.object({
  area: z.string().max(40).default("CV"),
  text: z.string().max(300),
  priority: suggestionPrioritySchema.default("medium"),
});

export type ProfileSuggestion = z.infer<typeof profileSuggestionSchema>;

export const importResultSchema = z.object({
  profile: profileDataSchema,
  suggestedTracks: z.array(z.string().max(60)).max(8).default([]),
  gaps: z.array(z.string().max(300)).max(40).default([]),
  suggestions: z.array(profileSuggestionSchema).max(20).default([]),
});

export type ImportResult = z.infer<typeof importResultSchema>;

function sectionTitle(title: string, fallback: string): string {
  return (title.trim() || fallback).slice(0, 80);
}

function uniqueId(base: string, used: Set<string>, fallback: string): string {
  const cleaned =
    base
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || fallback;
  let id = cleaned;
  let counter = 2;
  while (used.has(id)) id = `${cleaned}-${counter++}`;
  used.add(id);
  return id;
}

function coerceBullets(value: unknown, entryId: string): Bullet[] {
  const used = new Set<string>();
  return array(value)
    .map((item, index) => {
      const source = record(item);
      const text = str(source.text, 1200);
      if (!text) return null;
      let id = str(source.id, 120);
      if (!id || used.has(id)) id = `${entryId}-b${index + 1}`;
      used.add(id);
      return { id, text };
    })
    .filter((item): item is Bullet => Boolean(item))
    .slice(0, 20);
}

function coerceEntry(value: unknown, fallbackId: string): ProfileEntry | null {
  const source = record(value);
  const heading = str(source.heading, 200);
  if (!heading) return null;
  const id = str(source.id, 120) || fallbackId;
  return {
    id,
    heading,
    subheading: str(source.subheading, 200),
    location: str(source.location, 160),
    start: str(source.start, 40),
    end: str(source.end, 40),
    current: source.current === true,
    summary: str(source.summary, 1000),
    link: str(source.link, 400),
    bullets: coerceBullets(source.bullets, id),
    tags: strArray(source.tags, 20, 60),
  };
}

function coerceGroup(value: unknown, fallbackId: string): ProfileGroup | null {
  const source = record(value);
  const label = str(source.label, 80);
  const items = strArray(source.items, 40, 120);
  if (!label || !items.length) return null;
  return {
    id: str(source.id, 120) || fallbackId,
    label,
    items,
  };
}

/**
 * Accepts the current section shape, or any profile saved by the older
 * experience/projects/education/skillGroups model, and returns valid data.
 * This is what makes the schema change safe for existing rows.
 */
export function normalizeProfileData(value: unknown): ProfileData {
  const root = record(value);
  const identitySource = record(root.identity);
  const sections: ProfileSection[] = [];
  const usedSectionIds = new Set<string>();

  if (Array.isArray(root.sections)) {
    for (const [index, raw] of root.sections.entries()) {
      const source = record(raw);
      const title = sectionTitle(str(source.title, 80), `Section ${index + 1}`);
      const id = uniqueId(str(source.id, 80) || title, usedSectionIds, `section-${index + 1}`);
      const usedEntryIds = new Set<string>();

      const entries = array(source.entries)
        .map((item, entryIndex) => coerceEntry(item, `${id}-${entryIndex + 1}`))
        .filter((entry): entry is ProfileEntry => Boolean(entry))
        .map((entry) => {
          if (usedEntryIds.has(entry.id)) {
            entry.id = `${entry.id}-${usedEntryIds.size + 1}`;
          }
          usedEntryIds.add(entry.id);
          return entry;
        })
        .slice(0, 40);

      const groups = array(source.groups)
        .map((item, groupIndex) => coerceGroup(item, `${id}-g${groupIndex + 1}`))
        .filter((group): group is ProfileGroup => Boolean(group))
        .map((group) => {
          if (usedEntryIds.has(group.id)) {
            group.id = `${group.id}-${usedEntryIds.size + 1}`;
          }
          usedEntryIds.add(group.id);
          return group;
        })
        .slice(0, 20);

      const text = str(source.text, 4000);
      const kind =
        source.kind === "groups" || source.kind === "text" || source.kind === "entries"
          ? source.kind
          : groups.length && !entries.length
            ? "groups"
            : text && !entries.length
              ? "text"
              : "entries";

      sections.push({ id, title, kind, entries, groups, text });
    }
  } else {
    // Legacy shape.
    const experience = array(root.experience);
    const projects = array(root.projects);
    const education = array(root.education);
    const skillGroups = array(root.skillGroups);

    if (experience.length) {
      usedSectionIds.add("experience");
      sections.push({
        id: "experience",
        title: "Experience",
        kind: "entries",
        entries: experience
          .map((item, index) => {
            const source = record(item);
            return coerceEntry(
              {
                ...source,
                heading: source.role,
                subheading: source.company,
                summary: source.summary,
              },
              `exp-${index + 1}`,
            );
          })
          .filter((entry): entry is ProfileEntry => Boolean(entry)),
        groups: [],
        text: "",
      });
    }

    if (projects.length) {
      usedSectionIds.add("projects");
      sections.push({
        id: "projects",
        title: "Projects",
        kind: "entries",
        entries: projects
          .map((item, index) => {
            const source = record(item);
            return coerceEntry(
              {
                ...source,
                heading: source.name,
                subheading: source.stack,
                link: source.link,
              },
              `proj-${index + 1}`,
            );
          })
          .filter((entry): entry is ProfileEntry => Boolean(entry)),
        groups: [],
        text: "",
      });
    }

    if (education.length) {
      usedSectionIds.add("education");
      sections.push({
        id: "education",
        title: "Education",
        kind: "entries",
        entries: education
          .map((item, index) => {
            const source = record(item);
            return coerceEntry(
              {
                ...source,
                heading: source.degree,
                subheading: source.institution,
                summary: source.details,
              },
              `edu-${index + 1}`,
            );
          })
          .filter((entry): entry is ProfileEntry => Boolean(entry)),
        groups: [],
        text: "",
      });
    }

    const groups = skillGroups
      .map((item, index) => {
        const source = record(item);
        return coerceGroup(source, `skill-${index + 1}`);
      })
      .filter((group): group is ProfileGroup => Boolean(group));
    if (groups.length) {
      usedSectionIds.add("skills");
      sections.push({ id: "skills", title: "Skills", kind: "groups", entries: [], groups, text: "" });
    }
  }

  const fallback = emptyProfile();
  const identity: Record<string, unknown> = { ...fallback.identity, ...identitySource };
  if (!str(identity.fullName, 120)) identity.fullName = fallback.identity.fullName;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str(identity.email, 200))) {
    identity.email = fallback.identity.email;
  }

  const positioning: Record<string, string> = {};
  for (const [key, item] of Object.entries(record(root.positioning))) {
    const text = str(item, 1200);
    if (text) positioning[key.slice(0, 80)] = text;
  }

  const candidate = {
    identity,
    headline: str(root.headline, 240),
    summary: str(root.summary, 2000),
    positioning,
    sections,
    doNotClaim: strArray(root.doNotClaim, 50, 300),
    notes: str(root.notes, 20_000),
  };

  const parsed = profileDataSchema.safeParse(candidate);
  if (parsed.success) return parsed.data;

  // Last resort: keep the identity and text, drop anything the schema rejects.
  return profileDataSchema.parse({
    ...candidate,
    sections: sections.filter((section) => section.entries.length || section.groups.length || section.text),
  });
}

export function emptyProfile(email = "", name = ""): ProfileData {
  return profileDataSchema.parse({
    identity: {
      fullName: name || email.split("@")[0] || "Your name",
      email: email || "you@example.com",
      phone: "",
      location: "",
      website: "",
      github: "",
      linkedin: "",
      x: "",
    },
    headline: "",
    summary: "",
    positioning: {},
    sections: [
      { id: "experience", title: "Experience", kind: "entries", entries: [], groups: [], text: "" },
      { id: "education", title: "Education", kind: "entries", entries: [], groups: [], text: "" },
      { id: "skills", title: "Skills", kind: "groups", entries: [], groups: [], text: "" },
    ],
    doNotClaim: [],
    notes: "",
  });
}

export function profileCompleteness(profile: ProfileData): number {
  const entries = profile.sections.flatMap((section) => section.entries);
  const groups = profile.sections.flatMap((section) => section.groups);
  const bullets = entries.reduce((total, entry) => total + entry.bullets.length, 0);
  const checks = [
    Boolean(profile.identity.fullName && profile.identity.fullName !== "Your name"),
    Boolean(profile.identity.email),
    Boolean(profile.headline || profile.summary),
    profile.sections.some(sectionHasContent),
    entries.length > 0,
    bullets >= 3,
    groups.length > 0,
  ];
  const done = checks.filter(Boolean).length;
  return Math.round((done / checks.length) * 100);
}
