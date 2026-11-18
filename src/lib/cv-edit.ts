import { z } from "zod";
import { entrySchema, groupSchema, identitySchema, type ProfileData } from "@/lib/profile";
import type { CvDocument, CvSection } from "@/lib/latex/render";

/**
 * The editable source of a compiled CV.
 *
 * Every build stores this in documents.meta.document, so a later edit starts
 * from exactly what was rendered rather than from the variant or the model's
 * last answer. Documents built before this existed have no stored source and
 * are rebuilt from their job or variant once, then edited.
 */
export const cvDocumentSchema = z.object({
  identity: identitySchema,
  summary: z.string().max(2000).default(""),
  headline: z.string().max(240).optional(),
  sections: z
    .array(
      z.discriminatedUnion("kind", [
        z.object({
          id: z.string().min(1).max(80),
          title: z.string().min(1).max(80),
          kind: z.literal("entries"),
          entries: z.array(entrySchema).max(40),
        }),
        z.object({
          id: z.string().min(1).max(80),
          title: z.string().min(1).max(80),
          kind: z.literal("groups"),
          groups: z.array(groupSchema).max(20),
        }),
        z.object({
          id: z.string().min(1).max(80),
          title: z.string().min(1).max(80),
          kind: z.literal("text"),
          text: z.string().max(4000),
        }),
      ]),
    )
    .max(30),
});

export function storedCvDocument(meta: unknown): CvDocument | null {
  if (!meta || typeof meta !== "object") return null;
  const candidate = (meta as { document?: unknown }).document;
  if (!candidate) return null;
  const parsed = cvDocumentSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

/**
 * What the model is allowed to return when editing. It is deliberately
 * narrower than a CvDocument: entry identity (heading, employer, dates,
 * location) is not the model's to change, so it only names the entry and its
 * new bullets. The merge below pins everything else from the source.
 */
export const cvEditSchema = z.object({
  summary: z.string().max(2000).default(""),
  sections: z
    .array(
      z.object({
        id: z.string().min(1).max(80),
        title: z.string().max(80).default(""),
        entries: z
          .array(
            z.object({
              id: z.string().min(1).max(120),
              bullets: z.array(z.string().max(1200)).max(20).default([]),
            }),
          )
          .max(40)
          .default([]),
        groups: z
          .array(
            z.object({
              label: z.string().min(1).max(80),
              items: z.array(z.string().min(1).max(120)).max(40).default([]),
            }),
          )
          .max(20)
          .default([]),
        text: z.string().max(4000).default(""),
      }),
    )
    .max(30),
  changes: z.array(z.string().max(300)).max(12).default([]),
  notes: z.string().max(2000).default(""),
  /** Present when the request asked for something the memory cannot support. */
  missingFacts: z.array(z.string().max(300)).max(10).default([]),
});

export type CvEdit = z.infer<typeof cvEditSchema>;

export type MergeResult = {
  document: CvDocument;
  /** Sentences for the user: anything the model asked for but we refused. */
  notes: string[];
  /** Items the model tried to add that the memory does not contain. */
  droppedItems: string[];
  /** True when the merged document differs from the source. */
  changed: boolean;
};

function bulletTexts(values: string[]): string[] {
  return values
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, 20);
}

/** Everything a reader can see, with regenerated bullet ids left out. */
function textSignature(document: CvDocument): string {
  return JSON.stringify({
    summary: document.summary,
    sections: document.sections.map((section) => {
      if (section.kind === "entries") {
        return {
          id: section.id,
          title: section.title,
          kind: section.kind,
          entries: section.entries.map((entry) => ({
            id: entry.id,
            bullets: entry.bullets.map((bullet) => bullet.text),
          })),
        };
      }
      if (section.kind === "groups") {
        return {
          id: section.id,
          title: section.title,
          kind: section.kind,
          groups: section.groups.map((group) => ({ label: group.label, items: group.items })),
        };
      }
      return { id: section.id, title: section.title, kind: section.kind, text: section.text };
    }),
  });
}

/**
 * Folds the model's edit into the source document. Sections and entries the
 * model dropped are dropped here too (that is how "remove the oldest role"
 * works); anything it invented is discarded, because every kept entry is
 * looked up by id and copied from the source.
 */
export function applyCvEdit(source: CvDocument, edit: CvEdit, profile: ProfileData): MergeResult {
  const sourceSections = new Map(source.sections.map((section) => [section.id, section]));
  // Items already on the CV are accepted even if a tailored draft reworded
  // them; anything new must exist in the memory to survive the edit.
  const memoryItems = new Set(
    [
      ...profile.sections.flatMap((section) => section.groups.flatMap((group) => group.items)),
      ...source.sections.flatMap((section) =>
        section.kind === "groups" ? section.groups.flatMap((group) => group.items) : [],
      ),
    ].map((item) => item.toLowerCase()),
  );
  const notes: string[] = [];
  const unknownSections = new Set<string>();
  const unknownEntries = new Set<string>();
  const unknownItems = new Set<string>();
  const sections: CvSection[] = [];

  for (const incoming of edit.sections) {
    const base = sourceSections.get(incoming.id);
    if (!base) {
      unknownSections.add(incoming.id);
      continue;
    }

    const title = incoming.title.trim().slice(0, 80) || base.title;

    if (base.kind === "entries") {
      const byId = new Map(base.entries.map((entry) => [entry.id, entry]));
      const entries = incoming.entries.flatMap((candidate) => {
        const entry = byId.get(candidate.id);
        if (!entry) {
          unknownEntries.add(candidate.id);
          return [];
        }
        const bullets = bulletTexts(candidate.bullets).map((text, index) => ({
          id: `${entry.id}-e${index + 1}`,
          text,
        }));
        return [{ ...entry, bullets }];
      });
      sections.push({ id: base.id, title, kind: "entries", entries });
      continue;
    }

    if (base.kind === "groups") {
      const groups = incoming.groups
        .map((group, index) => ({
          id: `${base.id}-g${index + 1}`,
          label: group.label.trim().slice(0, 80) || `Group ${index + 1}`,
          items: group.items
            .map((item) => item.trim())
            .filter((item) => {
              if (!item) return false;
              // A skill line may be regrouped and relabelled, never extended
              // with a tool the memory does not contain.
              if (memoryItems.has(item.toLowerCase())) return true;
              unknownItems.add(item);
              return false;
            })
            .slice(0, 40),
        }))
        .filter((group) => group.items.length);
      sections.push({ id: base.id, title, kind: "groups", groups });
      continue;
    }

    sections.push({ id: base.id, title, kind: "text", text: incoming.text.trim().slice(0, 4000) });
  }

  const document: CvDocument = {
    ...source,
    summary: edit.summary.trim().slice(0, 2000),
    sections,
  };

  const changed = textSignature(document) !== textSignature(source);

  if (!sections.length && !document.summary) {
    notes.push("That edit would have removed every section, so the CV was left as it was.");
    return { document: source, notes, droppedItems: [...unknownItems], changed: false };
  }

  if (unknownSections.size) {
    notes.push(
      `Ignored ${unknownSections.size === 1 ? "a section" : `${unknownSections.size} sections`} that is not on this CV.`,
    );
  }
  if (unknownEntries.size) {
    notes.push(
      `Ignored ${unknownEntries.size === 1 ? "a row" : `${unknownEntries.size} rows`} the memory does not contain.`,
    );
  }
  if (unknownItems.size) {
    notes.push(
      `Dropped ${unknownItems.size === 1 ? "an item" : `${unknownItems.size} items`} that is not in your career memory: ${[...unknownItems]
        .slice(0, 4)
        .join(", ")}.`,
    );
  }
  if (edit.missingFacts.length) {
    notes.push(`Not on the CV because the memory cannot support it: ${edit.missingFacts.join("; ")}.`);
  }
  if (edit.notes.trim()) notes.push(edit.notes.trim().slice(0, 2000));

  return { document, notes, droppedItems: [...unknownItems], changed };
}

/** Every string the edit produced, for the truthfulness checks. */
export function editedTexts(document: CvDocument): string[] {
  const texts: string[] = [document.summary];
  for (const section of document.sections) {
    if (section.kind === "entries") {
      for (const entry of section.entries) {
        for (const bullet of entry.bullets) texts.push(bullet.text);
      }
    } else if (section.kind === "groups") {
      for (const group of section.groups) texts.push(group.label, ...group.items);
    } else {
      texts.push(section.text);
    }
  }
  return texts.filter(Boolean);
}
