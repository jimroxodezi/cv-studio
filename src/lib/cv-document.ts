import type {
  ProfileData,
  ProfileEntry,
  ProfileGroup,
  ProfileSection,
  TailorResult,
  VariantData,
} from "@/lib/profile";
import { sectionEntryIds } from "@/lib/profile";
import type { CvDocument, CvSection } from "@/lib/latex/render";
import type { VariantRow } from "@/lib/db/schema";

export function variantToData(variant: VariantRow): VariantData {
  return {
    name: variant.name,
    track: variant.track,
    summary: variant.summary,
    sectionIds: variant.sectionIds,
    entryIds: variant.entryIds,
    options: { pageTarget: variant.options?.pageTarget === 2 ? 2 : 1 },
  };
}

export function defaultSectionIds(profile: ProfileData): string[] {
  return profile.sections.map((section) => section.id);
}

export function defaultEntryIds(profile: ProfileData): string[] {
  return profile.sections.flatMap(sectionEntryIds);
}

function selectSection(
  section: ProfileSection,
  selectedEntryIds: Set<string>,
): CvSection | null {
  if (section.kind === "text") {
    return section.text.trim()
      ? { id: section.id, title: section.title, kind: "text", text: section.text }
      : null;
  }

  if (section.kind === "groups") {
    const groups = section.groups.filter((group) => selectedEntryIds.has(group.id));
    return groups.length
      ? { id: section.id, title: section.title, kind: "groups", groups }
      : null;
  }

  const entries = section.entries.filter((entry) => selectedEntryIds.has(entry.id));
  return entries.length
    ? { id: section.id, title: section.title, kind: "entries", entries }
    : null;
}

export function buildVariantDocument(profile: ProfileData, variant: VariantData): CvDocument {
  const selected = new Set(variant.entryIds);
  const sections = variant.sectionIds
    .map((id) => profile.sections.find((section) => section.id === id))
    .filter((section): section is ProfileSection => Boolean(section))
    .map((section) => selectSection(section, selected))
    .filter((section): section is CvSection => Boolean(section));

  return {
    identity: profile.identity,
    headline: profile.headline,
    summary:
      variant.summary.trim() ||
      profile.summary.trim() ||
      profile.positioning[variant.track] ||
      "",
    sections,
  };
}

function tailoredEntries(result: TailorResult): Map<string, ProfileEntry> {
  const map = new Map<string, ProfileEntry>();
  for (const entry of result.document.entries) {
    map.set(entry.entryId, {
      id: entry.entryId,
      heading: "",
      subheading: "",
      location: "",
      start: "",
      end: "",
      current: false,
      summary: "",
      link: "",
      bullets: entry.bullets.map((bullet, index) => ({
        id: `${entry.entryId}-tailored-${index}`,
        text: bullet.text,
      })),
      tags: [],
    });
  }
  return map;
}

function tailoredGroups(result: TailorResult): Map<string, ProfileGroup[]> {
  const map = new Map<string, ProfileGroup[]>();
  for (const section of result.document.groups) {
    map.set(
      section.sectionId,
      section.groups.map((group, index) => ({
        id: `${section.sectionId}-tailored-${index}`,
        label: group.label,
        items: group.items,
      })),
    );
  }
  return map;
}

function tailoredTexts(result: TailorResult): Map<string, string> {
  return new Map(result.document.texts.map((section) => [section.sectionId, section.text]));
}

export function buildTailoredDocument(
  profile: ProfileData,
  variant: VariantData,
  result: TailorResult,
): CvDocument {
  const generated = tailoredEntries(result);
  const generatedGroups = tailoredGroups(result);
  const generatedTexts = tailoredTexts(result);
  const selected = new Set(variant.entryIds);

  const sectionIds = result.document.sectionOrder.length
    ? result.document.sectionOrder
    : variant.sectionIds;

  const sections = sectionIds
    .map((id) => profile.sections.find((section) => section.id === id))
    .filter((section): section is ProfileSection => Boolean(section))
    .map((section): CvSection | null => {
      if (section.kind === "text") {
        const text = generatedTexts.get(section.id) ?? section.text;
        return text.trim()
          ? { id: section.id, title: section.title, kind: "text", text }
          : null;
      }

      if (section.kind === "groups") {
        const groups = generatedGroups.get(section.id) ?? section.groups.filter((group) => selected.has(group.id));
        return groups.length
          ? { id: section.id, title: section.title, kind: "groups", groups }
          : null;
      }

      const source = section.entries.filter((entry) => selected.has(entry.id));
      // If the model rewrote at least one entry here, respect its selection.
      // If it rewrote none, keep the base entries rather than return a blank CV.
      const rewritten = source.filter((entry) => generated.has(entry.id));
      const chosen = rewritten.length ? rewritten : source;
      const entries = chosen.map((entry) => {
        const generatedEntry = generated.get(entry.id);
        return generatedEntry?.bullets.length
          ? { ...entry, bullets: generatedEntry.bullets }
          : entry;
      });
      return entries.length
        ? { id: section.id, title: section.title, kind: "entries", entries }
        : null;
    })
    .filter((section): section is CvSection => Boolean(section));

  return {
    identity: profile.identity,
    headline: profile.headline,
    summary:
      result.document.summary.trim() ||
      variant.summary ||
      profile.summary ||
      profile.positioning[variant.track] ||
      "",
    sections,
  };
}

export function buildVariantLabel(variant: VariantData): string {
  return `${variant.name} — base CV`;
}
