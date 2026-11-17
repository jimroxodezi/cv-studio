"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, Field } from "@/components/ui";

export type SnapshotItem = {
  id: string;
  label: string;
  reason: string;
  createdAt: string;
  counts: { sections: number; entries: number; bullets: number; groups: number };
  headline: string;
};

const REASON_LABELS: Record<string, string> = {
  manual: "Saved by hand",
  clear: "Before clearing",
  import: "Before import replaced the memory",
  restore: "Before restoring an older snapshot",
};

function when(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function SnapshotHistory({ snapshots }: { snapshots: SnapshotItem[] }) {
  const router = useRouter();
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [confirmRestore, setConfirmRestore] = useState("");
  const [confirmDelete, setConfirmDelete] = useState("");

  async function saveSnapshot() {
    setBusy("save");
    setError("");
    setStatus("");
    try {
      const response = await fetch("/api/profile/snapshots", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ label }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error || "Could not save a snapshot.");
      setLabel("");
      setStatus("Snapshot saved.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save a snapshot.");
    } finally {
      setBusy("");
    }
  }

  async function restore(id: string) {
    setBusy(id);
    setError("");
    setStatus("");
    try {
      const response = await fetch(`/api/profile/snapshots/${id}/restore`, { method: "POST" });
      const body = (await response.json()) as {
        error?: string;
        counts?: { entries: number; bullets: number };
        repointedVariants?: number;
      };
      if (!response.ok) throw new Error(body.error || "Could not restore that snapshot.");
      setConfirmRestore("");
      setStatus(
        `Restored ${body.counts?.entries ?? 0} entries and ${body.counts?.bullets ?? 0} bullets. The previous memory is in History too.`,
      );
      // The page re-renders with the restored data; the editor is keyed on the
      // profile's updatedAt, so it reloads its fields from the server.
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not restore that snapshot.");
    } finally {
      setBusy("");
    }
  }

  async function remove(id: string) {
    setBusy(id);
    setError("");
    setStatus("");
    try {
      const response = await fetch(`/api/profile/snapshots/${id}`, { method: "DELETE" });
      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error || "Could not delete that snapshot.");
      }
      setConfirmDelete("");
      setStatus("Snapshot deleted.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete that snapshot.");
    } finally {
      setBusy("");
    }
  }

  return (
    <Card className="mt-6 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-serif text-lg font-bold">History</h2>
          <p className="hint">
            Clearing, importing a new dump and restoring all snapshot the memory first. Keep your own checkpoints
            before big edits. The last 20 automatic snapshots are kept; the ones you save by hand stay until you
            delete them.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div className="min-w-64 flex-1">
          <Field label="Save a checkpoint" hint="Optional label, for example “before rewriting my experience”.">
            <input
              className="input"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="What are you about to change?"
              maxLength={160}
            />
          </Field>
        </div>
        <button
          type="button"
          className="btn-secondary"
          onClick={saveSnapshot}
          disabled={busy !== ""}
        >
          {busy === "save" ? "Saving…" : "Save snapshot"}
        </button>
      </div>

      {status ? <p className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{status}</p> : null}
      {error ? <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

      {snapshots.length ? (
        <ul className="mt-4 divide-y divide-stone-100">
          {snapshots.map((snapshot) => (
            <li key={snapshot.id} className="py-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-stone-900">
                    {snapshot.label || REASON_LABELS[snapshot.reason] || "Snapshot"}
                  </p>
                  <p className="mt-0.5 text-xs text-stone-500">
                    {when(snapshot.createdAt)} · {snapshot.counts.entries} entries ·{" "}
                    {snapshot.counts.bullets} bullets
                    {snapshot.counts.groups ? ` · ${snapshot.counts.groups} lists` : ""}
                    {snapshot.headline ? ` · ${snapshot.headline}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-1.5">
                  {confirmRestore === snapshot.id ? (
                    <>
                      <button
                        type="button"
                        className="btn-secondary border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-900"
                        onClick={() => restore(snapshot.id)}
                        disabled={busy !== ""}
                      >
                        {busy === snapshot.id ? "Restoring…" : "Confirm restore"}
                      </button>
                      <button
                        type="button"
                        className="btn-ghost px-2 py-1 text-xs"
                        onClick={() => setConfirmRestore("")}
                        disabled={busy !== ""}
                      >
                        Cancel
                      </button>
                    </>
                  ) : confirmDelete === snapshot.id ? (
                    <>
                      <button
                        type="button"
                        className="btn-danger px-2 py-1 text-xs"
                        onClick={() => remove(snapshot.id)}
                        disabled={busy !== ""}
                      >
                        {busy === snapshot.id ? "Deleting…" : "Confirm delete"}
                      </button>
                      <button
                        type="button"
                        className="btn-ghost px-2 py-1 text-xs"
                        onClick={() => setConfirmDelete("")}
                        disabled={busy !== ""}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="btn-secondary px-2 py-1 text-xs"
                        onClick={() => {
                          setConfirmRestore(snapshot.id);
                          setConfirmDelete("");
                        }}
                      >
                        Restore
                      </button>
                      <button
                        type="button"
                        className="btn-ghost px-2 py-1 text-xs text-stone-500"
                        onClick={() => {
                          setConfirmDelete(snapshot.id);
                          setConfirmRestore("");
                        }}
                        aria-label="Delete snapshot"
                      >
                        ✕
                      </button>
                    </>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-stone-500">
          No snapshots yet. One is taken automatically before anything destructive.
        </p>
      )}
    </Card>
  );
}
