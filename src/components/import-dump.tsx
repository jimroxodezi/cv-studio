"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ImportResult } from "@/lib/profile";
import { Badge, Card } from "@/components/ui";

export function ImportDump() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [selectedTracks, setSelectedTracks] = useState<string[]>([]);

  async function extract(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const form = new FormData();
      if (file) form.set("file", file);
      else form.set("text", text);
      const response = await fetch("/api/profile/extract", { method: "POST", body: form });
      const data = (await response.json()) as ImportResult & { error?: string };
      if (!response.ok) throw new Error(data.error || "Could not read that dump.");
      setResult(data);
      setSelectedTracks(data.suggestedTracks.slice(0, 4));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read that dump.");
    } finally {
      setBusy(false);
    }
  }

  async function apply() {
    if (!result) return;
    setApplying(true);
    setError("");
    try {
      const save = await fetch("/api/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ data: result.profile, rawDump: text }),
      });
      const saved = (await save.json()) as { error?: string };
      if (!save.ok) throw new Error(saved.error || "Could not save the memory.");

      // Keep existing variants usable: point their selections at the new entries.
      const existingResponse = await fetch("/api/variants");
      if (existingResponse.ok) {
        const existing = (await existingResponse.json()) as {
          variants?: Array<{
            id: string;
            name: string;
            track: string;
            summary: string;
            sectionOrder: string[];
            options: { pageTarget: 1 | 2; showSummary: boolean; showSkills: boolean };
          }>;
        };
        for (const variant of existing.variants ?? []) {
          await fetch(`/api/variants/${variant.id}`, {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              name: variant.name,
              track: variant.track,
              summary: variant.summary,
              sectionOrder: variant.sectionOrder,
              skillGroupIds: result.profile.skillGroups.map((group) => group.id),
              experienceIds: result.profile.experience.map((entry) => entry.id),
              projectIds: result.profile.projects.map((entry) => entry.id),
              educationIds: result.profile.education.map((entry) => entry.id),
              options: variant.options,
            }),
          });
        }
      }

      for (const track of selectedTracks) {
        await fetch("/api/variants", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: track.charAt(0).toUpperCase() + track.slice(1), track }),
        });
      }
      router.push(selectedTracks.length ? "/variants" : "/profile");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the memory.");
      setApplying(false);
    }
  }

  if (result) {
    const profile = result.profile;
    return (
      <div className="space-y-5">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          Extracted a memory with {profile.experience.length} roles, {profile.projects.length} projects,{" "}
          {profile.skillGroups.length} skill groups, and {profile.education.length} education lines.
        </div>

        <Card className="p-6">
          <h2 className="font-serif text-xl font-bold">{profile.identity.fullName || "Your memory"}</h2>
          <p className="mt-1 text-sm text-stone-600">{profile.headline}</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {profile.experience.map((entry) => (
              <div key={entry.id} className="rounded-xl bg-stone-50 p-3">
                <p className="text-sm font-semibold text-stone-900">{entry.role || "(no role)"}</p>
                <p className="text-xs text-stone-500">
                  {entry.company || "(no company)"} · {entry.start} – {entry.current ? "Present" : entry.end}
                </p>
                <p className="mt-1 text-xs text-stone-500">{entry.bullets.length} bullets</p>
              </div>
            ))}
          </div>
          {profile.skillGroups.length ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {profile.skillGroups.map((group) => (
                <Badge key={group.id}>{group.label}: {group.items.slice(0, 4).join(", ")}</Badge>
              ))}
            </div>
          ) : null}
        </Card>

        {result.gaps.length ? (
          <Card className="border-amber-200 bg-amber-50/60 p-5">
            <h3 className="font-serif text-lg font-bold text-amber-900">Worth checking</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-900">
              {result.gaps.map((gap) => (
                <li key={gap}>{gap}</li>
              ))}
            </ul>
          </Card>
        ) : null}

        <Card className="p-6">
          <h3 className="font-serif text-lg font-bold">Create starting variants</h3>
          <p className="hint mb-3">Each one selects the entries that fit that track. You can edit them after.</p>
          <div className="flex flex-wrap gap-2">
            {result.suggestedTracks.length ? (
              result.suggestedTracks.map((track) => {
                const checked = selectedTracks.includes(track);
                return (
                  <label
                    key={track}
                    className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${
                      checked ? "border-amber-400 bg-amber-50 text-amber-900" : "border-stone-200 bg-white text-stone-600"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) =>
                        setSelectedTracks((current) =>
                          e.target.checked ? [...current, track] : current.filter((item) => item !== track),
                        )
                      }
                    />
                    {track}
                  </label>
                );
              })
            ) : (
              <p className="hint">No track suggestions. You can create variants by hand.</p>
            )}
          </div>
        </Card>

        {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-primary" onClick={apply} disabled={applying}>
            {applying ? "Saving…" : "Use this memory"}
          </button>
          <button type="button" className="btn-secondary" onClick={() => setResult(null)} disabled={applying}>
            Back
          </button>
        </div>
        <p className="hint">This replaces the current career memory. Existing variants are re-pointed at the new entries; their bullet content stays yours.</p>
      </div>
    );
  }

  return (
    <form onSubmit={extract} className="space-y-5">
      <Card className="p-6">
        <label className="block">
          <span className="label">Paste your professional dump</span>
          <textarea
            className="input min-h-64 font-mono text-xs leading-relaxed"
            placeholder="Paste an old CV, LinkedIn export, or rough notes. Include dates, employers, projects, numbers, and anything you are unsure about — the extractor will tell you what is missing."
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={Boolean(file)}
          />
        </label>
        <div className="mt-4 flex flex-col gap-2 rounded-xl border border-dashed border-stone-300 bg-stone-50 p-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-stone-800">Or upload a file</p>
            <p className="hint">PDF, DOCX, Markdown, or text · up to 8 MB</p>
          </div>
          <input
            type="file"
            accept=".pdf,.docx,.txt,.md,.markdown"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="text-sm"
          />
        </div>
        {file ? (
          <p className="mt-2 text-xs text-stone-500">
            Using {file.name}.{" "}
            <button type="button" className="font-semibold text-amber-800 underline" onClick={() => setFile(null)}>
              Remove file
            </button>
          </p>
        ) : null}
      </Card>

      {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn-primary" disabled={busy || (!text.trim() && !file)}>
          {busy ? "Reading your dump…" : "Extract career memory"}
        </button>
        <p className="hint">This uses one AI generation. It can take 30–60 seconds.</p>
      </div>
    </form>
  );
}
