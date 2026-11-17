"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  Education,
  Experience,
  ProfileData,
  Project,
  SkillGroup,
} from "@/lib/profile";
import { Badge, Card, Field } from "@/components/ui";

function uid(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

const tabs = [
  "Identity",
  "Summary",
  "Skills",
  "Experience",
  "Projects",
  "Education",
  "Guardrails",
] as const;
type Tab = (typeof tabs)[number];

export function ProfileEditor({ initialProfile }: { initialProfile: ProfileData }) {
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileData>(initialProfile);
  const [tab, setTab] = useState<Tab>("Identity");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [dirty, setDirty] = useState(false);

  function update<K extends keyof ProfileData>(key: K, value: ProfileData[K]) {
    setProfile((current) => ({ ...current, [key]: value }));
    setDirty(true);
    setStatus("");
  }

  function updateIdentity(key: keyof ProfileData["identity"], value: string) {
    setProfile((current) => ({ ...current, identity: { ...current.identity, [key]: value } }));
    setDirty(true);
  }

  function updateExperience(id: string, patch: Partial<Experience>) {
    update(
      "experience",
      profile.experience.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)),
    );
  }

  function updateProject(id: string, patch: Partial<Project>) {
    update(
      "projects",
      profile.projects.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)),
    );
  }

  function updateEducation(id: string, patch: Partial<Education>) {
    update(
      "education",
      profile.education.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)),
    );
  }

  async function save() {
    setBusy(true);
    setStatus("");
    try {
      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ data: profile }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Could not save.");
      setDirty(false);
      setStatus("Saved. Variants and new applications will use this memory.");
      router.refresh();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  const counts = useMemo(
    () => ({
      roles: profile.experience.length,
      bullets: profile.experience.reduce((total, entry) => total + entry.bullets.length, 0),
      projects: profile.projects.length,
      skills: profile.skillGroups.reduce((total, group) => total + group.items.length, 0),
    }),
    [profile],
  );

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Badge>{counts.roles} roles</Badge>
          <Badge>{counts.bullets} bullets</Badge>
          <Badge>{counts.projects} projects</Badge>
          <Badge>{counts.skills} skills</Badge>
          {dirty ? <Badge tone="amber">Unsaved changes</Badge> : <Badge tone="green">Saved</Badge>}
        </div>
        <button type="button" onClick={save} className="btn-primary" disabled={busy}>
          {busy ? "Saving…" : "Save career memory"}
        </button>
      </div>
      {status ? (
        <p className="mb-4 rounded-lg border border-stone-200 bg-white p-3 text-sm text-stone-700">{status}</p>
      ) : null}

      <div className="mb-5 flex flex-wrap gap-1 rounded-xl border border-stone-200 bg-white p-1">
        {tabs.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setTab(item)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              tab === item ? "bg-stone-950 text-white" : "text-stone-600 hover:bg-stone-100"
            }`}
          >
            {item}
          </button>
        ))}
      </div>

      {tab === "Identity" ? (
        <Card className="p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Full name">
              <input className="input" value={profile.identity.fullName} onChange={(e) => updateIdentity("fullName", e.target.value)} />
            </Field>
            <Field label="Email">
              <input className="input" type="email" value={profile.identity.email} onChange={(e) => updateIdentity("email", e.target.value)} />
            </Field>
            <Field label="Phone" hint="Leave blank if you do not want it on the CV.">
              <input className="input" value={profile.identity.phone} onChange={(e) => updateIdentity("phone", e.target.value)} />
            </Field>
            <Field label="Location">
              <input className="input" value={profile.identity.location} onChange={(e) => updateIdentity("location", e.target.value)} />
            </Field>
            <Field label="Website">
              <input className="input" value={profile.identity.website} onChange={(e) => updateIdentity("website", e.target.value)} />
            </Field>
            <Field label="GitHub">
              <input className="input" value={profile.identity.github} onChange={(e) => updateIdentity("github", e.target.value)} />
            </Field>
            <Field label="LinkedIn">
              <input className="input" value={profile.identity.linkedin} onChange={(e) => updateIdentity("linkedin", e.target.value)} />
            </Field>
            <Field label="X / Twitter">
              <input className="input" value={profile.identity.x} onChange={(e) => updateIdentity("x", e.target.value)} />
            </Field>
          </div>
        </Card>
      ) : null}

      {tab === "Summary" ? (
        <div className="grid gap-4">
          <Card className="p-6">
            <Field label="Headline" hint="One line that describes you, not a job title.">
              <input className="input" value={profile.headline} onChange={(e) => update("headline", e.target.value)} />
            </Field>
            <div className="mt-4">
              <Field label="Default summary" hint="Used by variants that do not override it.">
                <textarea className="input min-h-28" value={profile.summary} onChange={(e) => update("summary", e.target.value)} />
              </Field>
            </div>
          </Card>
          <Card className="p-6">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="font-serif text-lg font-bold">Track positioning</h3>
                <p className="hint">A short angle per track. Variants use these as their starting summary.</p>
              </div>
              <button
                type="button"
                className="btn-secondary"
                onClick={() =>
                  update("positioning", { ...profile.positioning, [`track-${Object.keys(profile.positioning).length + 1}`]: "" })
                }
              >
                Add track
              </button>
            </div>
            <div className="space-y-3">
              {Object.entries(profile.positioning).map(([key, value]) => (
                <div key={key} className="grid gap-2 md:grid-cols-[160px_1fr_auto]">
                  <input
                    className="input"
                    value={key}
                    onChange={(e) => {
                      const next = { ...profile.positioning };
                      delete next[key];
                      next[e.target.value || "track"] = value;
                      update("positioning", next);
                    }}
                  />
                  <input className="input" value={value} onChange={(e) => update("positioning", { ...profile.positioning, [key]: e.target.value })} />
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => {
                      const next = { ...profile.positioning };
                      delete next[key];
                      update("positioning", next);
                    }}
                  >
                    Remove
                  </button>
                </div>
              ))}
              {!Object.keys(profile.positioning).length ? <p className="hint">No track positioning yet.</p> : null}
            </div>
          </Card>
        </div>
      ) : null}

      {tab === "Skills" ? (
        <Card className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="font-serif text-lg font-bold">Skill groups</h3>
              <p className="hint">Each group becomes one line on the CV. Only list skills you can evidence.</p>
            </div>
            <button
              type="button"
              className="btn-secondary"
              onClick={() =>
                update("skillGroups", [
                  ...profile.skillGroups,
                  { id: uid("skill"), label: "New group", items: [], tracks: [] } as SkillGroup,
                ])
              }
            >
              Add group
            </button>
          </div>
          <div className="space-y-4">
            {profile.skillGroups.map((group) => (
              <div key={group.id} className="rounded-xl border border-stone-200 p-4">
                <div className="grid gap-3 md:grid-cols-[220px_1fr_auto]">
                  <Field label="Label">
                    <input
                      className="input"
                      value={group.label}
                      onChange={(e) =>
                        update(
                          "skillGroups",
                          profile.skillGroups.map((item) => (item.id === group.id ? { ...item, label: e.target.value } : item)),
                        )
                      }
                    />
                  </Field>
                  <Field label="Items" hint="Comma-separated.">
                    <input
                      className="input"
                      value={group.items.join(", ")}
                      onChange={(e) =>
                        update(
                          "skillGroups",
                          profile.skillGroups.map((item) =>
                            item.id === group.id
                              ? { ...item, items: e.target.value.split(",").map((value) => value.trim()).filter(Boolean) }
                              : item,
                          ),
                        )
                      }
                    />
                  </Field>
                  <button
                    type="button"
                    className="btn-ghost self-end"
                    onClick={() => update("skillGroups", profile.skillGroups.filter((item) => item.id !== group.id))}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
            {!profile.skillGroups.length ? <p className="hint">No skill groups yet.</p> : null}
          </div>
        </Card>
      ) : null}

      {tab === "Experience" ? (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              type="button"
              className="btn-secondary"
              onClick={() =>
                update("experience", [
                  ...profile.experience,
                  {
                    id: uid("exp"),
                    company: "",
                    location: "",
                    role: "",
                    start: "",
                    end: "",
                    current: false,
                    summary: "",
                    bullets: [],
                    tags: [],
                  } as Experience,
                ])
              }
            >
              Add role
            </button>
          </div>
          {profile.experience.map((entry, index) => (
            <Card key={entry.id} className="p-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-serif text-lg font-bold">
                  {entry.role || "New role"} {entry.company ? `· ${entry.company}` : ""}
                </h3>
                <button
                  type="button"
                  className="btn-ghost text-red-600"
                  onClick={() => update("experience", profile.experience.filter((item) => item.id !== entry.id))}
                >
                  Remove
                </button>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Company">
                  <input className="input" value={entry.company} onChange={(e) => updateExperience(entry.id, { company: e.target.value })} />
                </Field>
                <Field label="Role">
                  <input className="input" value={entry.role} onChange={(e) => updateExperience(entry.id, { role: e.target.value })} />
                </Field>
                <Field label="Location">
                  <input className="input" value={entry.location} onChange={(e) => updateExperience(entry.id, { location: e.target.value })} />
                </Field>
                <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
                  <Field label="Start">
                    <input className="input" value={entry.start} onChange={(e) => updateExperience(entry.id, { start: e.target.value })} />
                  </Field>
                  <Field label="End">
                    <input className="input" value={entry.end} onChange={(e) => updateExperience(entry.id, { end: e.target.value })} />
                  </Field>
                  <label className="flex items-end gap-2 pb-2 text-xs text-stone-600">
                    <input
                      type="checkbox"
                      checked={entry.current}
                      onChange={(e) => updateExperience(entry.id, { current: e.target.checked })}
                    />
                    Current
                  </label>
                </div>
              </div>
              <div className="mt-3">
                <Field label="Scope / context" hint="Not printed; useful for the AI when rewriting.">
                  <textarea className="input min-h-16" value={entry.summary} onChange={(e) => updateExperience(entry.id, { summary: e.target.value })} />
                </Field>
              </div>
              <div className="mt-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="label mb-0">Bullets ({entry.bullets.length})</span>
                  <button
                    type="button"
                    className="text-xs font-semibold text-amber-800 hover:underline"
                    onClick={() =>
                      updateExperience(entry.id, {
                        bullets: [...entry.bullets, { id: uid("bullet"), text: "" }],
                      })
                    }
                  >
                    + Add bullet
                  </button>
                </div>
                <div className="space-y-2">
                  {entry.bullets.map((bullet) => (
                    <div key={bullet.id} className="flex gap-2">
                      <textarea
                        className="input min-h-14 flex-1"
                        value={bullet.text}
                        placeholder="Strong verb + technology + result."
                        onChange={(e) =>
                          updateExperience(entry.id, {
                            bullets: entry.bullets.map((item) => (item.id === bullet.id ? { ...item, text: e.target.value } : item)),
                          })
                        }
                      />
                      <button
                        type="button"
                        className="btn-ghost self-start text-red-600"
                        onClick={() =>
                          updateExperience(entry.id, { bullets: entry.bullets.filter((item) => item.id !== bullet.id) })
                        }
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              <p className="mt-3 text-[11px] text-stone-400">Role {index + 1}</p>
            </Card>
          ))}
          {!profile.experience.length ? (
            <Card className="p-6 text-sm text-stone-500">No roles yet. Add your first one.</Card>
          ) : null}
        </div>
      ) : null}

      {tab === "Projects" ? (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              type="button"
              className="btn-secondary"
              onClick={() =>
                update("projects", [
                  ...profile.projects,
                  { id: uid("proj"), name: "", stack: "", link: "", bullets: [], tags: [] } as Project,
                ])
              }
            >
              Add project
            </button>
          </div>
          {profile.projects.map((entry) => (
            <Card key={entry.id} className="p-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-serif text-lg font-bold">{entry.name || "New project"}</h3>
                <button
                  type="button"
                  className="btn-ghost text-red-600"
                  onClick={() => update("projects", profile.projects.filter((item) => item.id !== entry.id))}
                >
                  Remove
                </button>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Name">
                  <input className="input" value={entry.name} onChange={(e) => updateProject(entry.id, { name: e.target.value })} />
                </Field>
                <Field label="Stack" hint="Comma-separated, shown next to the name.">
                  <input className="input" value={entry.stack} onChange={(e) => updateProject(entry.id, { stack: e.target.value })} />
                </Field>
              </div>
              <div className="mt-3">
                <Field label="Link">
                  <input className="input" value={entry.link} onChange={(e) => updateProject(entry.id, { link: e.target.value })} />
                </Field>
              </div>
              <div className="mt-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="label mb-0">Bullets ({entry.bullets.length})</span>
                  <button
                    type="button"
                    className="text-xs font-semibold text-amber-800 hover:underline"
                    onClick={() => updateProject(entry.id, { bullets: [...entry.bullets, { id: uid("bullet"), text: "" }] })}
                  >
                    + Add bullet
                  </button>
                </div>
                <div className="space-y-2">
                  {entry.bullets.map((bullet) => (
                    <div key={bullet.id} className="flex gap-2">
                      <textarea
                        className="input min-h-14 flex-1"
                        value={bullet.text}
                        onChange={(e) =>
                          updateProject(entry.id, {
                            bullets: entry.bullets.map((item) => (item.id === bullet.id ? { ...item, text: e.target.value } : item)),
                          })
                        }
                      />
                      <button
                        type="button"
                        className="btn-ghost self-start text-red-600"
                        onClick={() => updateProject(entry.id, { bullets: entry.bullets.filter((item) => item.id !== bullet.id) })}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : null}

      {tab === "Education" ? (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              type="button"
              className="btn-secondary"
              onClick={() =>
                update("education", [
                  ...profile.education,
                  { id: uid("edu"), degree: "", institution: "", location: "", start: "", end: "", details: "" } as Education,
                ])
              }
            >
              Add education
            </button>
          </div>
          {profile.education.map((entry) => (
            <Card key={entry.id} className="p-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-serif text-lg font-bold">{entry.degree || "New qualification"}</h3>
                <button
                  type="button"
                  className="btn-ghost text-red-600"
                  onClick={() => update("education", profile.education.filter((item) => item.id !== entry.id))}
                >
                  Remove
                </button>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Degree">
                  <input className="input" value={entry.degree} onChange={(e) => updateEducation(entry.id, { degree: e.target.value })} />
                </Field>
                <Field label="Institution">
                  <input className="input" value={entry.institution} onChange={(e) => updateEducation(entry.id, { institution: e.target.value })} />
                </Field>
                <Field label="Location">
                  <input className="input" value={entry.location} onChange={(e) => updateEducation(entry.id, { location: e.target.value })} />
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Start year">
                    <input className="input" value={entry.start} onChange={(e) => updateEducation(entry.id, { start: e.target.value })} />
                  </Field>
                  <Field label="End year">
                    <input className="input" value={entry.end} onChange={(e) => updateEducation(entry.id, { end: e.target.value })} />
                  </Field>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : null}

      {tab === "Guardrails" ? (
        <Card className="p-6">
          <h3 className="font-serif text-lg font-bold">Do-not-claim list</h3>
          <p className="hint mb-4">
            Anything here is checked against every draft. If the model uses it, the CV is
            flagged before you send it.
          </p>
          <div className="space-y-2">
            {profile.doNotClaim.map((item, index) => (
              <div key={`${item}-${index}`} className="flex gap-2">
                <input
                  className="input"
                  value={item}
                  onChange={(e) =>
                    update("doNotClaim", profile.doNotClaim.map((value, i) => (i === index ? e.target.value : value)))
                  }
                />
                <button
                  type="button"
                  className="btn-ghost text-red-600"
                  onClick={() => update("doNotClaim", profile.doNotClaim.filter((_, i) => i !== index))}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <button type="button" className="btn-secondary mt-3" onClick={() => update("doNotClaim", [...profile.doNotClaim, ""])}>
            Add guardrail
          </button>
          <div className="mt-6">
            <Field label="Private notes" hint="Not printed. Ambiguities, things to confirm, context.">
              <textarea className="input min-h-32" value={profile.notes} onChange={(e) => update("notes", e.target.value)} />
            </Field>
          </div>
        </Card>
      ) : null}

      <div className="sticky bottom-4 mt-6 flex justify-end">
        <button type="button" onClick={save} className="btn-primary shadow-lg" disabled={busy}>
          {busy ? "Saving…" : "Save career memory"}
        </button>
      </div>
    </div>
  );
}
