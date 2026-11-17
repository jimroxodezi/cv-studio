"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, Field } from "@/components/ui";

export type ProfileCounts = {
  sections: number;
  entries: number;
  bullets: number;
  groups: number;
};

/**
 * Wipe the memory. Lives outside the editor so the page can order it after the
 * snapshot history: the safety net is visible above the destructive action.
 */
export function ClearMemory({ counts }: { counts: ProfileCounts }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function clearMemory() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/profile/clear", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirm }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error || "Could not clear the memory.");
      router.push("/profile/import");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not clear the memory.");
      setBusy(false);
    }
  }

  return (
    <Card className="mt-6 border-red-200 bg-red-50/40 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <h2 className="font-serif text-lg font-bold text-red-900">Start over from a fresh dump</h2>
          <p className="mt-1 text-sm leading-relaxed text-red-900/80">
            Erases <strong>{counts.sections} sections, {counts.entries} entries and {counts.bullets} bullets</strong>,
            plus the saved source text. A snapshot is kept in History first, so this is recoverable. Your variants keep
            their settings but are emptied until you import again.
          </p>
        </div>
        {open ? null : (
          <button
            type="button"
            className="btn-danger shrink-0"
            onClick={() => {
              setOpen(true);
              setConfirm("");
              setError("");
            }}
          >
            Clear everything
          </button>
        )}
      </div>

      {open ? (
        <div className="mt-4 space-y-3">
          <div className="max-w-xs">
            <Field label="Type CLEAR to confirm" hint="A snapshot is taken first, so you can restore it.">
              <input
                className="input"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                placeholder="CLEAR"
                autoComplete="off"
                aria-label="Type CLEAR to confirm"
              />
            </Field>
          </div>
          {error ? <p className="rounded-lg bg-red-100 p-3 text-sm text-red-800">{error}</p> : null}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="btn-danger-solid"
              onClick={clearMemory}
              disabled={busy || confirm.trim().toUpperCase() !== "CLEAR"}
            >
              {busy ? "Clearing…" : "Erase the career memory"}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setOpen(false);
                setConfirm("");
                setError("");
              }}
              disabled={busy}
            >
              Cancel
            </button>
            <span className="text-xs text-red-900/70">
              You will land on the import screen to paste or upload the new dump.
            </span>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
