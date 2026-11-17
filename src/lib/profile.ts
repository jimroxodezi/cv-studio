import { z } from "zod";

export const bulletSchema = z.object({
  id: z.string().min(1),
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

export const skillGroupSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1).max(80),
  items: z.array(z.string().min(1).max(120)).max(40).default([]),
  tracks: z.array(z.string().min(1).max(40)).default([]),
});

export const experienceSchema = z.object({
  id: z.string().min(1),
  company: z.string().min(1).max(160),
  location: z.string().max(160).default(""),
  role: z.string().min(1).max(160),
  start: z.string().max(40).default(""),
  end: z.string().max(40).default(""),
  current: z.boolean().default(false),
  summary: z.string().max(1000).default(""),
  bullets: z.array(bulletSchema).max(20).default([]),
  tags: z.array(z.string().max(60)).default([]),
});

export const projectSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(160),
  stack: z.string().max(300).default(""),
  link: z.string().max(400).default(""),
  bullets: z.array(bulletSchema).max(12).default([]),
  tags: z.array(z.string().max(60)).default([]),
});

export const educationSchema = z.object({
  id: z.string().min(1),
  degree: z.string().min(1).max(200),
  institution: z.string().min(1).max(200),
  location: z.string().max(160).default(""),
  start: z.string().max(40).default(""),
  end: z.string().max(40).default(""),
  details: z.string().max(600).default(""),
});

export const profileDataSchema = z.object({
  identity: identitySchema,
  headline: z.string().max(240).default(""),
  summary: z.string().max(2000).default(""),
  positioning: z.record(z.string(), z.string().max(1200)).default({}),
  skillGroups: z.array(skillGroupSchema).max(30).default([]),
  experience: z.array(experienceSchema).max(30).default([]),
  projects: z.array(projectSchema).max(30).default([]),
  education: z.array(educationSchema).max(15).default([]),
  doNotClaim: z.array(z.string().max(300)).max(50).default([]),
  notes: z.string().max(20000).default(""),
});

export type Bullet = z.infer<typeof bulletSchema>;
export type Identity = z.infer<typeof identitySchema>;
export type SkillGroup = z.infer<typeof skillGroupSchema>;
export type Experience = z.infer<typeof experienceSchema>;
export type Project = z.infer<typeof projectSchema>;
export type Education = z.infer<typeof educationSchema>;
export type ProfileData = z.infer<typeof profileDataSchema>;

export const sectionKeySchema = z.enum([
  "summary",
  "skills",
  "experience",
  "projects",
  "education",
]);
export type SectionKey = z.infer<typeof sectionKeySchema>;

export const variantOptionsSchema = z.object({
  pageTarget: z.union([z.literal(1), z.literal(2)]).default(1),
  showSummary: z.boolean().default(true),
  showSkills: z.boolean().default(true),
});

export const variantDataSchema = z.object({
  name: z.string().min(1).max(120),
  track: z.string().min(1).max(60),
  summary: z.string().max(2000).default(""),
  sectionOrder: z.array(sectionKeySchema).default([
    "summary",
    "skills",
    "experience",
    "projects",
    "education",
  ]),
  skillGroupIds: z.array(z.string()).default([]),
  experienceIds: z.array(z.string()).default([]),
  projectIds: z.array(z.string()).default([]),
  educationIds: z.array(z.string()).default([]),
  options: variantOptionsSchema.default({ pageTarget: 1, showSummary: true, showSkills: true }),
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
  skills: z
    .array(
      z.object({
        label: z.string().min(1).max(80),
        items: z.array(z.string().min(1).max(120)).max(40).default([]),
      }),
    )
    .max(12)
    .default([]),
  experience: z
    .array(
      z.object({
        entryId: z.string().min(1),
        bullets: z.array(generatedBulletSchema).max(12).default([]),
      }),
    )
    .max(15)
    .default([]),
  projects: z
    .array(
      z.object({
        entryId: z.string().min(1),
        bullets: z.array(generatedBulletSchema).max(8).default([]),
      }),
    )
    .max(15)
    .default([]),
  educationIds: z.array(z.string()).max(10).default([]),
  sectionOrder: z
    .array(sectionKeySchema)
    .default(["summary", "skills", "experience", "projects", "education"]),
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

export const importResultSchema = z.object({
  profile: profileDataSchema,
  suggestedTracks: z.array(z.string().max(60)).max(8).default([]),
  gaps: z.array(z.string().max(300)).max(40).default([]),
});

export type ImportResult = z.infer<typeof importResultSchema>;

export function emptyProfile(email = "", name = ""): ProfileData {
  return profileDataSchema.parse({
    identity: {
      fullName: name,
      email,
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
    skillGroups: [],
    experience: [],
    projects: [],
    education: [],
    doNotClaim: [],
    notes: "",
  });
}

export function profileCompleteness(profile: ProfileData): number {
  const checks = [
    Boolean(profile.identity.fullName),
    Boolean(profile.identity.email),
    Boolean(profile.summary || Object.keys(profile.positioning).length),
    profile.skillGroups.length > 0,
    profile.experience.length > 0,
    profile.experience.some((entry) => entry.bullets.length > 0),
    profile.education.length > 0,
    profile.projects.length > 0,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}
