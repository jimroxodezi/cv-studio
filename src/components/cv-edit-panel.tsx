"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui";

export type CvEditOutcome = {
  documentId: string;
  pageCount: number;
  warnings: string[];
  changes: string[];
  notes: string;
  model: string;
  atsPreview?: string;
};

const SUGGESTIONS = [
  "Cut it down to one page",
  "Shorten the summary to two lines",
  "Move Projects above Experience",
  "Trim the weakest bullet from each role",
];

/**
 * The PDF is the deliverable, not the editable thing. This dialog turns a plain
 * instruction into a new compiled version: it edits the structured CV, pins
 * every employer, title and date, then rebuilds the LaTeX.
 */
export function CvEditPanel({
  open,
  documentId,
  onClose,
  onEdited,
}: {
  open: boolean;
  documentId: string;
  onClose: () => void;
  onEdited: (outcome: CvEditOutcome) => void;
}) {
  const [instruction, setInstruction] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [outcome, setOutcome] = useState<CvEditOutcome | null>(null);

  const requestClose = () => {
    if (!busy) onClose();
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);

  if (!open) return null;

  async function applyEdit() {
    const request = instruction.trim();
    if (!request || busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/documents/${documentId}/edit`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ instruction: request }),
      });
      const data = (await response.json()) as CvEditOutcome & { error?: string };
      if (!response.ok || !data.documentId) throw new Error(data.error || "Could not apply that edit.");
      setOutcome(data);
      setInstruction("");
      onEdited(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not apply that edit.");
    } finally {
      setBusy(false);
    }
  }

  function suggest(text: string) {
    setInstruction((current) => (current.trim() ? `${current.trim()} ${text}` : text));
  }

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cv-edit-title"
      onClick={requestClose}
    >
      <div className="mx-auto my-6 w-full max-w-2xl" onClick={(event) => event.stopPropagation()}>
        <Card className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="cv-edit-title" className="font-serif text-xl font-bold">
                Edit this CV
              </h2>
              <p className="hint">
                Describe the change in plain words. The editor cuts, reorders and rewords what your
                career memory already supports; it never adds a fact. Each edit is saved as a new
                version, so nothing is lost.
              </p>
            </div>
            <button
              type="button"
              className="btn-ghost shrink-0 px-2 py-1 text-lg leading-none"
              onClick={requestClose}
              disabled={busy}
              aria-label="Close"
            >
              ×
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-1.5">
            {SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                className="pill border-stone-200 bg-stone-50 text-stone-600 hover:border-stone-300 hover:text-stone-900"
                onClick={() => suggest(suggestion)}
                disabled={busy}
              >
                {suggestion}
              </button>
            ))}
          </div>

          <textarea
            className="input mt-3 min-h-28 text-sm leading-relaxed"
            placeholder="e.g. Cut the summary to two lines, move Projects above Experience, and drop the oldest bullet under Pigra Labs."
            value={instruction}
            onChange={(event) => setInstruction(event.target.value)}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                event.preventDefault();
                void applyEdit();
              }
            }}
            maxLength={2000}
            disabled={busy}
            autoFocus
          />

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-stone-500">
              {instruction.trim().length}/2000 · Ctrl+Enter applies
            </p>
            <div className="flex gap-2">
              <button type="button" className="btn-secondary" onClick={requestClose} disabled={busy}>
                Close
              </button>
              <button type="button" className="btn-primary" onClick={applyEdit} disabled={busy || !instruction.trim()}>
                {busy ? "Editing…" : "Apply edit"}
              </button>
            </div>
          </div>

          {busy ? (
            <p className="mt-3 text-xs text-stone-500">
              Editing the CV, checking it against the memory, then recompiling the PDF. About 30
              seconds.
            </p>
          ) : null}
          {error ? <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

          {outcome ? (
            <div className="mt-4 rounded-xl border border-stone-200 bg-stone-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                {outcome.changes.length ? "What the editor did" : "No change made"}
              </p>
              {outcome.changes.length ? (
                <ul className="mt-1.5 list-disc space-y-1 pl-4 text-sm leading-relaxed text-stone-700">
                  {outcome.changes.map((change) => (
                    <li key={change}>{change}</li>
                  ))}
                </ul>
              ) : null}
              {outcome.notes ? (
                <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-stone-500">{outcome.notes}</p>
              ) : null}
              <p className="mt-2 text-xs text-stone-500">
                {outcome.pageCount} page{outcome.pageCount === 1 ? "" : "s"} now. The preview behind
                this dialog is the rebuilt PDF.
              </p>
            </div>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
