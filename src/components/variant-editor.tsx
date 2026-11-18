"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ProfileData, ProfileSection, VariantData } from "@/lib/profile";
import { Badge, Card, Field } from "@/components/ui";
import { CvEditPanel } from "@/components/cv-edit-panel";

type BuildResult = {
  documentId: string;
  pageCount: number;
  warnings: string[];
  atsPreview: string;
};

function dateRange(start: string, end: string, current: boolean): string {
  return [start, current ? "Present" : end].filter(Boolean).join(" – ");
}

function sectionIdsOf(section: ProfileSection): string[] {
  if (section.kind === "entries") return section.entries.map((entry) => entry.id);
  if (section.kind === "groups") return section.groups.map((group) => group.id);
  return [];
}

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
  const [editing, setEditing] = useState(false);

  function patch(patchValue: Partial<VariantData>) {
    setData((current) => ({ ...current, ...patchValue }));
    setStatus("");
  }

  function toggleEntry(id: string) {
    const selected = data.entryIds.includes(id);
    patch({
      entryIds: selected ? data.entryIds.filter((item) => item !== id) : [...data.entryIds, id],
    });
  }

  function setSectionEntries(section: ProfileSection, all: boolean) {
    const ids = sectionIdsOf(section);
    const rest = data.entryIds.filter((id) => !ids.includes(id));
    patch({ entryIds: all ? [...rest, ...ids] : rest });
  }

  function toggleSection(section: ProfileSection, include: boolean) {
    patch({
      sectionIds: include
        ? [...data.sectionIds.filter((id) => id !== section.id), section.id]
        : data.sectionIds.filter((id) => id !== section.id),
    });
  }

  function moveSection(index: number, direction: -1 | 1) {
    const next = [...data.sectionIds];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    patch({ sectionIds: next });
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

  const included = data.sectionIds
    .map((id) => profile.sections.find((section) => section.id === id))
    .filter((section): section is ProfileSection => Boolean(section));
  const excluded = profile.sections.filter((section) => !data.sectionIds.includes(section.id));

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_460px]">
      <div className="space-y-4">
        <Card className="p-5">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Variant name">
              <input className="input" value={data.name} onChange={(e) => patch({ name: e.target.value })} />
            </Field>
            <Field label="Career angle" hint="Free text. Used as a label and as a fallback summary key.">
              <input
                className="input"
                value={data.track}
                placeholder="Nursing, teaching, operations, research…"
                onChange={(e) => patch({ track: e.target.value })}
              />
            </Field>
          </div>
          <div className="mt-3">
            <Field label="Summary" hint="Leave blank to use the matching career angle or your default summary.">
              <textarea className="input min-h-24" value={data.summary} onChange={(e) => patch({ summary: e.target.value })} />
            </Field>
            {profile.positioning[data.track] ? (
              <button
                type="button"
                className="mt-2 text-xs font-semibold text-amber-800 underline underline-offset-2"
                onClick={() => patch({ summary: profile.positioning[data.track] })}
              >
                Use the “{data.track}” summary
              </button>
            ) : null}
          </div>
        </Card>

        <Card className="p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-serif text-lg font-bold">Sections</h2>
              <p className="hint">Include the sections this angle should show, then set their order.</p>
            </div>
            <select
              className="rounded border border-stone-200 bg-white px-2 py-1 text-xs"
              value={data.options.pageTarget}
              onChange={(e) =>
                patch({ options: { ...data.options, pageTarget: Number(e.target.value) === 2 ? 2 : 1 } })
              }
            >
              <option value={1}>1 page</option>
              <option value={2}>2 pages</option>
            </select>
          </div>

          {included.length ? (
            <ul className="divide-y divide-stone-100">
              {included.map((section, index) => (
                <li key={section.id} className="flex items-center justify-between py-2">
                  <div>
                    <span className="text-sm font-medium text-stone-800">{section.title}</span>
                    <span className="ml-2 text-xs text-stone-400">
                      {section.kind === "entries"
                        ? `${section.entries.length} rows`
                        : section.kind === "groups"
                          ? `${section.groups.length} lists`
                          : "prose"}
                    </span>
                  </div>
                  <span className="flex gap-1">
                    <button type="button" className="btn-ghost px-2 py-1 text-xs" onClick={() => moveSection(index, -1)} disabled={index === 0}>
                      ↑
                    </button>
                    <button
                      type="button"
                      className="btn-ghost px-2 py-1 text-xs"
                      onClick={() => moveSection(index, 1)}
                      disabled={index === included.length - 1}
                    >
                      ↓
                    </button>
                    <button type="button" className="btn-ghost px-2 py-1 text-xs text-red-600" onClick={() => toggleSection(section, false)}>
                      Hide
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-stone-500">No sections included. Add at least one below.</p>
          )}

          {excluded.length ? (
            <div className="mt-4 border-t border-stone-100 pt-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-400">Hidden sections</p>
              <div className="flex flex-wrap gap-2">
                {excluded.map((section) => (
                  <button key={section.id} type="button" className="btn-secondary px-3 py-1 text-xs" onClick={() => toggleSection(section, true)}>
                    + {section.title}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </Card>

        {included.map((section) => {
          if (section.kind === "text") {
            return (
              <Card key={section.id} className="p-5">
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="font-serif text-lg font-bold">{section.title}</h2>
                  <Badge>always included</Badge>
                </div>
                <p className="text-sm leading-relaxed text-stone-600">
                  {section.text.trim() || "This section is empty in your memory."}
                </p>
              </Card>
            );
          }

          if (section.kind === "groups") {
            return (
              <SelectionCard
                key={section.id}
                title={section.title}
                count={section.groups.length}
                items={section.groups.map((group) => ({
                  id: group.id,
                  label: group.label,
                  detail: group.items.join(", "),
                }))}
                selected={data.entryIds}
                onToggle={toggleEntry}
                onAll={(all) => setSectionEntries(section, all)}
              />
            );
          }

          return (
            <SelectionCard
              key={section.id}
              title={section.title}
              count={section.entries.length}
              items={section.entries.map((entry) => ({
                id: entry.id,
                label: entry.heading || "(untitled row)",
                detail: [entry.subheading, dateRange(entry.start, entry.end, entry.current)]
                  .filter(Boolean)
                  .join(" · "),
              }))}
              selected={data.entryIds}
              onToggle={toggleEntry}
              onAll={(all) => setSectionEntries(section, all)}
            />
          );
        })}

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
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn-secondary px-2 py-1 text-xs" onClick={() => setEditing(true)}>
                  Edit with a prompt
                </button>
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
                className="h-[60dvh] min-h-[360px] w-full bg-stone-100 xl:h-[calc(100vh-13rem)] xl:max-h-[720px] xl:min-h-[420px]"
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
                Your PDF will appear here. It is compiled on the server with the same LaTeX layout
                as the rest of your CVs.
              </p>
            </div>
          )}
        </Card>
        <p className="mt-3 text-xs leading-relaxed text-stone-500">
          LaTeX is single-column and table-free so applicant tracking systems read it in order. The
          preview is the real PDF, not a mock-up.
        </p>
      </div>

      {build ? (
        <CvEditPanel
          open={editing}
          documentId={build.documentId}
          onClose={() => setEditing(false)}
          onEdited={(outcome) =>
            setBuild({
              documentId: outcome.documentId,
              pageCount: outcome.pageCount,
              warnings: outcome.warnings,
              atsPreview: outcome.atsPreview ?? "",
            })
          }
        />
      ) : null}
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
  const selectedCount = items.filter((item) => selected.includes(item.id)).length;

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="font-serif text-lg font-bold">{title}</h2>
          <Badge>
            {selectedCount}/{count}
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
                  {item.detail ? <span className="block text-xs text-stone-500">{item.detail}</span> : null}
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
