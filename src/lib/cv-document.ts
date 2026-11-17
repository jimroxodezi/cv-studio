import type { ProfileData, SectionKey, TailorResult, VariantData } from "@/lib/profile";
import type { CvDocument } from "@/lib/latex/render";
import type { VariantRow } from "@/lib/db/schema";

function orderByIds<T extends { id: string }>(items: T[], ids: string[]): T[] {
  const map = new Map(items.map((item) => [item.id, item]));
  return ids.map((id) => map.get(id)).filter((item): item is T => Boolean(item));
}

export function variantToData(variant: VariantRow): VariantData {
  return {
    name: variant.name,
    track: variant.track,
    summary: variant.summary,
    sectionOrder: variant.sectionOrder,
    skillGroupIds: variant.skillGroupIds,
    experienceIds: variant.experienceIds,
    projectIds: variant.projectIds,
    educationIds: variant.educationIds,
    options: variant.options,
  };
}

export function defaultSectionOrder(): SectionKey[] {
  return ["summary", "skills", "experience", "projects", "education"];
}

export function buildVariantDocument(profile: ProfileData, variant: VariantData): CvDocument {
  const summary =
    variant.summary.trim() ||
    profile.summary.trim() ||
    profile.positioning[variant.track] ||
    "";

  return {
    identity: profile.identity,
    summary,
    skills: orderByIds(profile.skillGroups, variant.skillGroupIds),
    experience: orderByIds(profile.experience, variant.experienceIds),
    projects: orderByIds(profile.projects, variant.projectIds),
    education: orderByIds(profile.education, variant.educationIds),
    sectionOrder: variant.sectionOrder.length ? variant.sectionOrder : defaultSectionOrder(),
  };
}

export function buildTailoredDocument(
  profile: ProfileData,
  variant: VariantData,
  result: TailorResult,
): CvDocument {
  const generatedExperience = new Map(result.document.experience.map((entry) => [entry.entryId, entry]));
  const generatedProjects = new Map(result.document.projects.map((entry) => [entry.entryId, entry]));

  const sourceExperience = orderByIds(profile.experience, variant.experienceIds);
  const experience = sourceExperience
    .map((entry) => {
      const generated = generatedExperience.get(entry.id);
      if (!generated) return null;
      return {
        ...entry,
        bullets: generated.bullets.map((bullet, index) => ({
          id: `${entry.id}-tailored-${index}`,
          text: bullet.text,
        })),
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

  const sourceProjects = orderByIds(profile.projects, variant.projectIds);
  const projects = sourceProjects
    .map((entry) => {
      const generated = generatedProjects.get(entry.id);
      if (!generated) return null;
      return {
        ...entry,
        bullets: generated.bullets.map((bullet, index) => ({
          id: `${entry.id}-tailored-${index}`,
          text: bullet.text,
        })),
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

  const skills = result.document.skills.length
    ? result.document.skills.map((group, index) => ({
        id: `tailored-skill-${index}`,
        label: group.label,
        items: group.items,
        tracks: [variant.track],
      }))
    : orderByIds(profile.skillGroups, variant.skillGroupIds);

  const education = result.document.educationIds.length
    ? orderByIds(profile.education, result.document.educationIds)
    : orderByIds(profile.education, variant.educationIds);

  const summary = result.document.summary.trim() || variant.summary || profile.summary;

  return {
    identity: profile.identity,
    summary,
    skills,
    experience,
    projects,
    education,
    sectionOrder: result.document.sectionOrder.length
      ? result.document.sectionOrder
      : variant.sectionOrder,
  };
}

export function buildVariantLabel(variant: VariantData): string {
  return `${variant.name} — base CV`;
}
