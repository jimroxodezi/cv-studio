import "server-only";
import type { ProfileData } from "@/lib/profile";
import { emptyProfile, profileDataSchema } from "@/lib/profile";
import type { UserRow } from "@/lib/db/schema";
import { completeJson, resolveProvider } from "@/lib/ai/provider";
import { SYSTEM_PROMPT, importPrompt } from "@/lib/ai/prompts";
import { assertGenerationQuota, recordUsage } from "@/lib/rate-limit";

type Loose = Record<string, unknown>;

function record(value: unknown): Loose {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Loose) : {};
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function bool(value: unknown): boolean {
  return value === true;
}

function strArray(value: unknown): string[] {
  return array(value)
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function ensureIds(items: unknown[], prefix: string): Loose[] {
  const used = new Set<string>();
  return items.map((item, index) => {
    const source = record(item);
    let id = str(source.id).trim();
    if (!id || used.has(id)) id = `${prefix}-${index + 1}`;
    used.add(id);
    return { ...source, id };
  });
}

function ensureBullets(entry: Loose, entryId: string): Loose {
  const used = new Set<string>();
  const bullets = array(entry.bullets).map((item, index) => {
    const source = record(item);
    const text = str(source.text).trim();
    let id = str(source.id).trim();
    if (!id || used.has(id)) id = `${entryId}-b${index + 1}`;
    used.add(id);
    return { id, text };
  });
  return { ...entry, bullets: bullets.filter((bullet) => bullet.text) };
}

function normalizeProfile(raw: unknown, fallback: ProfileData): ProfileData {
  const root = record(raw);
  const profile = record(root.profile ?? root);
  const identity = { ...fallback.identity, ...record(profile.identity) };

  const skillGroups = ensureIds(array(profile.skillGroups), "skill").map((group) => ({
    ...group,
    label: str(group.label),
    items: strArray(group.items),
    tracks: strArray(group.tracks),
  }));

  const experience = ensureIds(array(profile.experience), "exp").map((entry) => {
    const current = bool(entry.current);
    return ensureBullets(
      {
        ...entry,
        company: str(entry.company),
        location: str(entry.location),
        role: str(entry.role),
        start: str(entry.start),
        end: str(entry.end),
        current,
        summary: str(entry.summary),
        tags: strArray(entry.tags),
      },
      String(entry.id),
    );
  });

  const projects = ensureIds(array(profile.projects), "proj").map((entry) =>
    ensureBullets(
      {
        ...entry,
        name: str(entry.name),
        stack: str(entry.stack),
        link: str(entry.link),
        tags: strArray(entry.tags),
      },
      String(entry.id),
    ),
  );

  const education = ensureIds(array(profile.education), "edu").map((entry) => ({
    ...entry,
    degree: str(entry.degree),
    institution: str(entry.institution),
    location: str(entry.location),
    start: str(entry.start),
    end: str(entry.end),
    details: str(entry.details),
  }));

  const positioning: Record<string, string> = {};
  for (const [key, value] of Object.entries(record(profile.positioning))) {
    if (typeof value === "string" && value.trim()) positioning[key] = value;
  }

  return profileDataSchema.parse({
    identity,
    headline: str(profile.headline),
    summary: str(profile.summary),
    positioning,
    skillGroups,
    experience,
    projects,
    education,
    doNotClaim: strArray(profile.doNotClaim),
    notes: str(profile.notes),
  });
}

export async function extractCareerDump(options: {
  user: UserRow;
  dump: string;
}): Promise<{ profile: ProfileData; suggestedTracks: string[]; gaps: string[]; model: string }> {
  const config = resolveProvider(options.user);
  await assertGenerationQuota(options.user.id, config.usedServerKey);

  const fallback = emptyProfile(options.user.email, options.user.name);
  const raw = await completeJson({
    config,
    system: SYSTEM_PROMPT,
    user: importPrompt(options.dump, options.user.name, options.user.email),
    maxTokens: 8000,
    validate: (value) => value,
  });

  const root = record(raw);
  const profile = normalizeProfile(raw, fallback);
  const suggestedTracks = strArray(root.suggestedTracks).slice(0, 6);
  const gaps = strArray(root.gaps).slice(0, 30);

  await recordUsage(options.user.id, "import", config.model, config.usedServerKey);
  return { profile, suggestedTracks, gaps, model: config.model };
}
