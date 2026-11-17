"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ProfileData, SectionKey, VariantData } from "@/lib/profile";
import { Badge, Card, Field } from "@/components/ui";

const sectionLabels: Record<SectionKey, string> = {
  summary: "Summary",
  skills: "Technical skills",
  experience: "Experience",
  projects: "Selected projects",
  education: "Education",
};

type BuildResult = {
  documentId: string;
  pageCount: number;
  warnings: string[];
  atsPreview: string;
};

export function VariantEditor({
  variantId,
  initial,
  profile,
}: {
  variantId: string;
  initial: VariantData;
  profile: ProfileData;
}) {
  const router = useRouter();
  const [data, setData] = useState<VariantData>(initial);
  const [busy, setBusy] = useState(false);
  const [building, setBuilding] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [build, setBuild] = useState<BuildResult | null>(null);

  function patch(patchValue: Partial<VariantData>) {
    setData((current) => ({ ...current, ...patchValue }));
    setStatus("");
  }

  function toggle(key: "skillGroupIds" | "experienceIds" | "projectIds" | "educationIds", id: string) {
    const current = data[key];
    patch({ [key]: current.includes(id) ? current.filter((item) => item !== id) : [...current, id] } as Partial<VariantData>);
  }

  function moveSection(index: number, direction: -1 | 1) {
    const next = [...data.sectionOrder];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    patch({ sectionOrder: next });
  }

  async function save(): Promise<boolean> {
    setBusy(true);
    setError("");
    setStatus("");
    try {
      const response = await fetch(`/api/variants/${variantId}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(data),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error || "Could not save.");
      setStatus("Saved.");
      router.refresh();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function buildPdf() {
    setBuilding(true);
    setError("");
    setStatus("");
    try {
      if (!(await save())) return;
      const response = await fetch(`/api/variants/${variantId}/build`, { method: "POST" });
      const body = (await response.json()) as BuildResult & { error?: string };
      if (!response.ok) throw new Error(body.error || "Could not build the PDF.");
      setBuild(body);
      setStatus("PDF built.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not build the PDF.");
    } finally {
      setBuilding(false);
    }
  }

  async function remove() {
    if (!window.confirm("Delete this variant? The career memory and applications are not affected.")) return;
    const response = await fetch(`/api/variants/${variantId}`, { method: "DELETE" });
    if (response.ok) {
      router.push("/variants");
      router.refresh();
    } else {
      setError("Could not delete this variant.");
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_460px]">
      <div className="space-y-4">
        <Card className="p-5">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Variant name">
              <input className="input" value={data.name} onChange={(e) => patch({ name: e.target.value })} />
            </Field>
            <Field label="Track">
              <input className="input" value={data.track} onChange={(e) => patch({ track: e.target.value })} />
            </Field>
          </div>
          <div className="mt-3">
            <Field label="Summary" hint="Leave blank to use the matching track positioning from your memory.">
              <textarea className="input min-h-24" value={data.summary} onChange={(e) => patch({ summary: e.target.value })} />
            </Field>
            {profile.positioning[data.track] ? (
              <button
                type="button"
                className="mt-2 text-xs font-semibold text-amber-800 underline underline-offset-2"
                onClick={() => patch({ summary: profile.positioning[data.track] })}
              >
                Use “{data.track}” positioning
              </button>
            ) : null}
          </div>
        </Card>

        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-serif text-lg font-bold">Section order</h2>
            <div className="flex items-center gap-3 text-xs text-stone-500">
              <label className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={data.options.showSummary}
                  onChange={(e) => patch({ options: { ...data.options, showSummary: e.target.checked } })}
                />
                summary
              </label>
              <label className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={data.options.showSkills}
                  onChange={(e) => patch({ options: { ...data.options, showSkills: e.target.checked } })}
                />
                skills
              </label>
              <select
                className="rounded border border-stone-200 bg-white px-2 py-1"
                value={data.options.pageTarget}
                onChange={(e) =>
                  patch({ options: { ...data.options, pageTarget: Number(e.target.value) === 2 ? 2 : 1 } })
                }
              >
                <option value={1}>1 page</option>
                <option value={2}>2 pages</option>
              </select>
            </div>
          </div>
          <ul className="divide-y divide-stone-100">
            {data.sectionOrder.map((section, index) => (
              <li key={section} className="flex items-center justify-between py-2">
                <span className="text-sm font-medium text-stone-800">{sectionLabels[section]}</span>
                <span className="flex gap-1">
                  <button type="button" className="btn-ghost px-2 py-1 text-xs" onClick={() => moveSection(index, -1)} disabled={index === 0}>
                    ↑
                  </button>
                  <button
                    type="button"
                    className="btn-ghost px-2 py-1 text-xs"
                    onClick={() => moveSection(index, 1)}
                    disabled={index === data.sectionOrder.length - 1}
                  >
                    ↓
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <SelectionCard
          title="Experience"
          count={profile.experience.length}
          items={profile.experience.map((entry) => ({
            id: entry.id,
            label: `${entry.role} — ${entry.company}`,
            detail: `${entry.bullets.length} bullets · ${entry.start} – ${entry.current ? "Present" : entry.end}`,
          }))}
          selected={data.experienceIds}
          onToggle={(id) => toggle("experienceIds", id)}
          onAll={(all) => patch({ experienceIds: all ? profile.experience.map((entry) => entry.id) : [] })}
        />

        <SelectionCard
          title="Skill groups"
          count={profile.skillGroups.length}
          items={profile.skillGroups.map((group) => ({
            id: group.id,
            label: group.label,
            detail: group.items.join(", "),
          }))}
          selected={data.skillGroupIds}
          onToggle={(id) => toggle("skillGroupIds", id)}
          onAll={(all) => patch({ skillGroupIds: all ? profile.skillGroups.map((group) => group.id) : [] })}
        />

        <SelectionCard
          title="Projects"
          count={profile.projects.length}
          items={profile.projects.map((entry) => ({
            id: entry.id,
            label: entry.name,
            detail: entry.stack,
          }))}
          selected={data.projectIds}
          onToggle={(id) => toggle("projectIds", id)}
          onAll={(all) => patch({ projectIds: all ? profile.projects.map((entry) => entry.id) : [] })}
        />

        <SelectionCard
          title="Education"
          count={profile.education.length}
          items={profile.education.map((entry) => ({
            id: entry.id,
            label: entry.degree,
            detail: `${entry.institution} · ${entry.start}–${entry.end}`,
          }))}
          selected={data.educationIds}
          onToggle={(id) => toggle("educationIds", id)}
          onAll={(all) => patch({ educationIds: all ? profile.education.map((entry) => entry.id) : [] })}
        />

        {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
        {status ? <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{status}</p> : null}

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn-primary" onClick={buildPdf} disabled={building || busy}>
            {building ? "Building PDF…" : "Save & build PDF"}
          </button>
          <button type="button" className="btn-secondary" onClick={save} disabled={busy || building}>
            {busy ? "Saving…" : "Save"}
          </button>
          <button type="button" className="btn-danger ml-auto" onClick={remove}>
            Delete
          </button>
        </div>
      </div>

      <div className="xl:sticky xl:top-6 xl:self-start">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-stone-100 p-4">
            <div>
              <h2 className="font-serif text-lg font-bold">Preview</h2>
              {build ? (
                <p className="text-xs text-stone-500">
                  {build.pageCount} page{build.pageCount === 1 ? "" : "s"} · target {data.options.pageTarget}
                </p>
              ) : (
                <p className="text-xs text-stone-500">Build to see the compiled LaTeX PDF.</p>
              )}
            </div>
            {build ? (
              <div className="flex gap-2">
                <a className="btn-secondary px-2 py-1 text-xs" href={`/api/documents/${build.documentId}?format=pdf&download=1`}>
                  PDF
                </a>
                <a className="btn-secondary px-2 py-1 text-xs" href={`/api/documents/${build.documentId}?format=tex&download=1`}>
                  .tex
                </a>
              </div>
            ) : null}
          </div>
          {build ? (
            <>
              <iframe
                key={build.documentId}
                title="CV preview"
                src={`/api/documents/${build.documentId}`}
                className="h-[720px] w-full bg-stone-100"
              />
              {build.warnings.length ? (
                <div className="border-t border-amber-200 bg-amber-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">Review</p>
                  <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-amber-900">
                    {build.warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <details className="border-t border-stone-100 p-3">
                <summary className="cursor-pointer text-xs font-semibold text-stone-600">ATS text extract</summary>
                <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap text-[11px] text-stone-600">{build.atsPreview}</pre>
              </details>
            </>
          ) : (
            <div className="flex h-72 flex-col items-center justify-center gap-2 p-6 text-center">
              <span className="text-3xl text-stone-300">▤</span>
              <p className="text-sm text-stone-500">
                Your PDF will appear here. It is compiled on the server with the same LaTeX
                layout as the rest of your CVs.
              </p>
            </div>
          )}
        </Card>
        <p className="mt-3 text-xs leading-relaxed text-stone-500">
          LaTeX is single-column and table-free so applicant tracking systems read it in order.
          The preview is the real PDF, not a mock-up.
        </p>
      </div>
    </div>
  );
}

function SelectionCard({
  title,
  count,
  items,
  selected,
  onToggle,
  onAll,
}: {
  title: string;
  count: number;
  items: Array<{ id: string; label: string; detail: string }>;
  selected: string[];
  onToggle: (id: string) => void;
  onAll: (all: boolean) => void;
}) {
  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="font-serif text-lg font-bold">{title}</h2>
          <Badge>
            {selected.length}/{count}
          </Badge>
        </div>
        <div className="flex gap-2 text-xs">
          <button type="button" className="font-semibold text-amber-800 hover:underline" onClick={() => onAll(true)}>
            All
          </button>
          <button type="button" className="font-semibold text-stone-500 hover:underline" onClick={() => onAll(false)}>
            None
          </button>
        </div>
      </div>
      {items.length ? (
        <ul className="space-y-1">
          {items.map((item) => (
            <li key={item.id}>
              <label className="flex cursor-pointer items-start gap-3 rounded-lg px-2 py-2 hover:bg-stone-50">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={selected.includes(item.id)}
                  onChange={() => onToggle(item.id)}
                />
                <span>
                  <span className="block text-sm font-medium text-stone-800">{item.label}</span>
                  <span className="block text-xs text-stone-500">{item.detail}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-stone-500">Nothing in this section yet.</p>
      )}
    </Card>
  );
}
