"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  ProfileData,
  ProfileEntry,
  ProfileGroup,
  ProfileSection,
  SectionKind,
} from "@/lib/profile";
import { Badge, Card, Field } from "@/components/ui";

function uid(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

type Tab = "Identity" | "Summary" | "Sections" | "Guardrails";
const tabs: Tab[] = ["Identity", "Summary", "Sections", "Guardrails"];

const kindLabels: Record<SectionKind, string> = {
  entries: "Dated rows",
  groups: "Labelled lists",
  text: "Prose block",
};

const kindHints: Record<SectionKind, string> = {
  entries: "Jobs, degrees, placements, licenses, publications, awards — anything with a title and usually dates.",
  groups: "Compact lists such as skills, languages, or equipment. Each row is one line on the CV.",
  text: "A short paragraph with no rows, such as a profile or research statement.",
};

const sectionTemplates: Record<SectionKind, { title: string; body: string }> = {
  entries: { title: "Experience", body: "heading, subheading, dates, bullets" },
  groups: { title: "Skills", body: "label and comma-separated items" },
  text: { title: "Profile", body: "a short prose block" },
};

function cleanProfile(profile: ProfileData): ProfileData {
  return {
    ...profile,
    sections: profile.sections.map((section) => ({
      ...section,
      entries: section.entries
        .filter((entry) => entry.heading.trim())
        .map((entry) => ({ ...entry, bullets: entry.bullets.filter((bullet) => bullet.text.trim()) })),
      groups: section.groups
        .map((group) => ({ ...group, items: group.items.map((item) => item.trim()).filter(Boolean) }))
        .filter((group) => group.label.trim() && group.items.length),
    })),
  };
}

export function ProfileEditor({ initialProfile }: { initialProfile: ProfileData }) {
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileData>(initialProfile);
  const [tab, setTab] = useState<Tab>("Sections");
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

  function updateSection(id: string, patch: Partial<ProfileSection>) {
    update(
      "sections",
      profile.sections.map((section) => (section.id === id ? { ...section, ...patch } : section)),
    );
  }

  function moveSection(id: string, direction: -1 | 1) {
    const index = profile.sections.findIndex((section) => section.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= profile.sections.length) return;
    const next = [...profile.sections];
    [next[index], next[target]] = [next[target], next[index]];
    update("sections", next);
  }

  function addSection(kind: SectionKind) {
    const template = sectionTemplates[kind];
    update("sections", [
      ...profile.sections,
      {
        id: uid("section"),
        title: template.title,
        kind,
        entries: [],
        groups: [],
        text: "",
      },
    ]);
  }

  function updateEntry(sectionId: string, entryId: string, patch: Partial<ProfileEntry>) {
    updateSection(sectionId, {
      entries: profile.sections
        .find((section) => section.id === sectionId)!
        .entries.map((entry) => (entry.id === entryId ? { ...entry, ...patch } : entry)),
    });
  }

  function addEntry(sectionId: string) {
    const section = profile.sections.find((item) => item.id === sectionId);
    if (!section) return;
    updateSection(sectionId, {
      entries: [
        ...section.entries,
        {
          id: uid("entry"),
          heading: "",
          subheading: "",
          location: "",
          start: "",
          end: "",
          current: false,
          summary: "",
          link: "",
          bullets: [],
          tags: [],
        },
      ],
    });
  }

  function updateGroup(sectionId: string, groupId: string, patch: Partial<ProfileGroup>) {
    const section = profile.sections.find((item) => item.id === sectionId);
    if (!section) return;
    updateSection(sectionId, {
      groups: section.groups.map((group) => (group.id === groupId ? { ...group, ...patch } : group)),
    });
  }

  function addGroup(sectionId: string) {
    const section = profile.sections.find((item) => item.id === sectionId);
    if (!section) return;
    updateSection(sectionId, {
      groups: [...section.groups, { id: uid("group"), label: "", items: [] }],
    });
  }

  async function save() {
    setBusy(true);
    setStatus("");
    const data = cleanProfile(profile);
    try {
      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ data }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error || "Could not save.");
      setProfile(data);
      setDirty(false);
      setStatus("Saved. Variants and new applications will use this memory.");
      router.refresh();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  const counts = useMemo(() => {
    const entries = profile.sections.flatMap((section) => section.entries);
    return {
      sections: profile.sections.length,
      entries: entries.length,
      bullets: entries.reduce((total, entry) => total + entry.bullets.length, 0),
      groups: profile.sections.reduce((total, section) => total + section.groups.length, 0),
    };
  }, [profile]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Badge>{counts.sections} sections</Badge>
          <Badge>{counts.entries} entries</Badge>
          <Badge>{counts.bullets} bullets</Badge>
          <Badge>{counts.groups} lists</Badge>
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
              tab === item
                ? "bg-[var(--color-ink)] text-[var(--color-paper)]"
                : "text-stone-600 hover:bg-stone-100"
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
            <Field label="GitHub" hint="Optional. Leave blank if it does not fit your field.">
              <input className="input" value={profile.identity.github} onChange={(e) => updateIdentity("github", e.target.value)} />
            </Field>
            <Field label="LinkedIn">
              <input className="input" value={profile.identity.linkedin} onChange={(e) => updateIdentity("linkedin", e.target.value)} />
            </Field>
            <Field label="Other profile link">
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
              <Field label="Default summary" hint="Used by variants that do not override it, and as a starting point for tailoring.">
                <textarea className="input min-h-28" value={profile.summary} onChange={(e) => update("summary", e.target.value)} />
              </Field>
            </div>
          </Card>
          <Card className="p-6">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="font-serif text-lg font-bold">Career angles</h3>
                <p className="hint">
                  Optional short summaries for the directions you apply in. Variants can start from one of these.
                </p>
              </div>
              <button
                type="button"
                className="btn-secondary"
                onClick={() =>
                  update("positioning", {
                    ...profile.positioning,
                    [`angle-${Object.keys(profile.positioning).length + 1}`]: "",
                  })
                }
              >
                Add angle
              </button>
            </div>
            <div className="space-y-3">
              {Object.entries(profile.positioning).map(([key, value]) => (
                <div key={key} className="grid gap-2 md:grid-cols-[200px_1fr_auto]">
                  <input
                    className="input"
                    value={key}
                    onChange={(e) => {
                      const next = { ...profile.positioning };
                      delete next[key];
                      next[e.target.value || "angle"] = value;
                      update("positioning", next);
                    }}
                  />
                  <input
                    className="input"
                    value={value}
                    onChange={(e) => update("positioning", { ...profile.positioning, [key]: e.target.value })}
                  />
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
              {!Object.keys(profile.positioning).length ? <p className="hint">No career angles yet.</p> : null}
            </div>
          </Card>
        </div>
      ) : null}

      {tab === "Sections" ? (
        <div className="space-y-4">
          <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <h3 className="font-serif text-lg font-bold">Build your own sections</h3>
              <p className="hint">
                There is no fixed CV shape. Use the titles and rows that fit your profession, and drag
                the arrows to set their order.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(kindLabels) as SectionKind[]).map((kind) => (
                <button key={kind} type="button" className="btn-secondary" onClick={() => addSection(kind)}>
                  + {kindLabels[kind]}
                </button>
              ))}
            </div>
          </Card>

          {profile.sections.map((section, index) => (
            <Card key={section.id} className="p-5">
              <div className="mb-4 flex flex-wrap items-end gap-3">
                <div className="min-w-52 flex-1">
                  <Field label="Section title">
                    <input
                      className="input"
                      value={section.title}
                      onChange={(e) => updateSection(section.id, { title: e.target.value })}
                    />
                  </Field>
                </div>
                <div className="w-44">
                  <Field label="Content type">
                    <select
                      className="input"
                      value={section.kind}
                      onChange={(e) => updateSection(section.id, { kind: e.target.value as SectionKind })}
                    >
                      {(Object.keys(kindLabels) as SectionKind[]).map((kind) => (
                        <option key={kind} value={kind}>
                          {kindLabels[kind]}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
                <div className="flex items-center gap-1 pb-0.5">
                  <button
                    type="button"
                    className="btn-ghost px-2 py-1 text-xs"
                    onClick={() => moveSection(section.id, -1)}
                    disabled={index === 0}
                    title="Move up"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="btn-ghost px-2 py-1 text-xs"
                    onClick={() => moveSection(section.id, 1)}
                    disabled={index === profile.sections.length - 1}
                    title="Move down"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="btn-ghost px-2 py-1 text-xs text-red-600"
                    onClick={() => update("sections", profile.sections.filter((item) => item.id !== section.id))}
                  >
                    Remove
                  </button>
                </div>
              </div>
              <p className="mb-4 text-xs text-stone-500">{kindHints[section.kind]}</p>

              {section.kind === "entries" ? (
                <div className="space-y-4">
                  <div className="flex justify-end">
                    <button type="button" className="btn-secondary" onClick={() => addEntry(section.id)}>
                      Add row
                    </button>
                  </div>
                  {section.entries.map((entry) => (
                    <div key={entry.id} className="rounded-xl border border-stone-200 p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <h4 className="font-serif text-base font-bold">{entry.heading || "New row"}</h4>
                        <button
                          type="button"
                          className="btn-ghost text-red-600"
                          onClick={() =>
                            updateSection(section.id, {
                              entries: section.entries.filter((item) => item.id !== entry.id),
                            })
                          }
                        >
                          Remove
                        </button>
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        <Field label="Heading" hint="Job title, degree, publication, license, or award.">
                          <input
                            className="input"
                            value={entry.heading}
                            onChange={(e) => updateEntry(section.id, entry.id, { heading: e.target.value })}
                          />
                        </Field>
                        <Field label="Subheading" hint="Employer, institution, publisher, or context. Optional.">
                          <input
                            className="input"
                            value={entry.subheading}
                            onChange={(e) => updateEntry(section.id, entry.id, { subheading: e.target.value })}
                          />
                        </Field>
                        <Field label="Location">
                          <input
                            className="input"
                            value={entry.location}
                            onChange={(e) => updateEntry(section.id, entry.id, { location: e.target.value })}
                          />
                        </Field>
                        <Field label="Link" hint="Optional. A publication, credential, or portfolio URL.">
                          <input
                            className="input"
                            value={entry.link}
                            onChange={(e) => updateEntry(section.id, entry.id, { link: e.target.value })}
                          />
                        </Field>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_1fr_auto]">
                          <Field label="Start">
                            <input
                              className="input"
                              value={entry.start}
                              onChange={(e) => updateEntry(section.id, entry.id, { start: e.target.value })}
                            />
                          </Field>
                          <Field label="End">
                            <input
                              className="input"
                              value={entry.end}
                              onChange={(e) => updateEntry(section.id, entry.id, { end: e.target.value })}
                            />
                          </Field>
                          <label className="col-span-2 flex items-center gap-2 pb-1 text-xs text-stone-600 sm:col-span-1 sm:items-end sm:pb-2">
                            <input
                              type="checkbox"
                              checked={entry.current}
                              onChange={(e) => updateEntry(section.id, entry.id, { current: e.target.checked })}
                            />
                            Current
                          </label>
                        </div>
                      </div>
                      <div className="mt-3">
                        <Field label="Context or scope" hint="Not printed on the CV; useful for the AI when rewriting.">
                          <textarea
                            className="input min-h-16"
                            value={entry.summary}
                            onChange={(e) => updateEntry(section.id, entry.id, { summary: e.target.value })}
                          />
                        </Field>
                      </div>
                      <div className="mt-4">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="label mb-0">Bullets ({entry.bullets.length})</span>
                          <button
                            type="button"
                            className="text-xs font-semibold text-amber-800 hover:underline"
                            onClick={() =>
                              updateEntry(section.id, entry.id, {
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
                                placeholder="Strong verb + specific skill or method + result."
                                onChange={(e) =>
                                  updateEntry(section.id, entry.id, {
                                    bullets: entry.bullets.map((item) =>
                                      item.id === bullet.id ? { ...item, text: e.target.value } : item,
                                    ),
                                  })
                                }
                              />
                              <button
                                type="button"
                                className="btn-ghost self-start text-red-600"
                                onClick={() =>
                                  updateEntry(section.id, entry.id, {
                                    bullets: entry.bullets.filter((item) => item.id !== bullet.id),
                                  })
                                }
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                  {!section.entries.length ? (
                    <p className="text-sm text-stone-500">No rows in this section yet.</p>
                  ) : null}
                </div>
              ) : null}

              {section.kind === "groups" ? (
                <div className="space-y-3">
                  <div className="flex justify-end">
                    <button type="button" className="btn-secondary" onClick={() => addGroup(section.id)}>
                      Add list
                    </button>
                  </div>
                  {section.groups.map((group) => (
                    <div key={group.id} className="grid gap-3 rounded-xl border border-stone-200 p-4 md:grid-cols-[220px_1fr_auto]">
                      <Field label="Label">
                        <input
                          className="input"
                          value={group.label}
                          onChange={(e) => updateGroup(section.id, group.id, { label: e.target.value })}
                        />
                      </Field>
                      <Field label="Items" hint="Comma-separated. They render on one line.">
                        <input
                          className="input"
                          value={group.items.join(", ")}
                          onChange={(e) =>
                            updateGroup(section.id, group.id, {
                              items: e.target.value.split(",").map((value) => value.trimStart()),
                            })
                          }
                        />
                      </Field>
                      <button
                        type="button"
                        className="btn-ghost self-end text-red-600"
                        onClick={() =>
                          updateSection(section.id, {
                            groups: section.groups.filter((item) => item.id !== group.id),
                          })
                        }
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  {!section.groups.length ? <p className="text-sm text-stone-500">No lists in this section yet.</p> : null}
                </div>
              ) : null}

              {section.kind === "text" ? (
                <Field label="Text" hint="Rendered as a short paragraph under the section title.">
                  <textarea
                    className="input min-h-28"
                    value={section.text}
                    onChange={(e) => updateSection(section.id, { text: e.target.value })}
                  />
                </Field>
              ) : null}
            </Card>
          ))}

          {!profile.sections.length ? (
            <Card className="p-6 text-sm text-stone-500">
              No sections yet. Add one above, or import a dump and let the studio build them for you.
            </Card>
          ) : null}
        </div>
      ) : null}

      {tab === "Guardrails" ? (
        <Card className="p-6">
          <h3 className="font-serif text-lg font-bold">Do-not-claim list</h3>
          <p className="hint mb-4">
            Anything here is checked against every draft. If the model uses it, the CV is flagged
            before you send it.
          </p>
          <div className="space-y-2">
            {profile.doNotClaim.map((item, index) => (
              <div key={`${item}-${index}`} className="flex gap-2">
                <input
                  className="input"
                  value={item}
                  onChange={(e) =>
                    update(
                      "doNotClaim",
                      profile.doNotClaim.map((value, i) => (i === index ? e.target.value : value)),
                    )
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


      <div className="sticky bottom-0 z-20 mt-6 flex justify-end border-t border-[var(--border)] bg-[var(--color-paper)] py-3 md:border-0 md:bg-transparent md:py-0">
        <button type="button" onClick={save} className="btn-primary shadow-lg" disabled={busy}>
          {busy ? "Saving…" : "Save career memory"}
        </button>
      </div>
    </div>
  );
}
