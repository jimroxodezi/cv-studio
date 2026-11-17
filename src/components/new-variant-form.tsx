"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, Field } from "@/components/ui";

const tracks = ["ai", "backend", "telecom", "research", "general", "custom"];

export function NewVariantForm({ disabled }: { disabled?: boolean }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [track, setTrack] = useState("general");
  const [customTrack, setCustomTrack] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/variants", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, track: track === "custom" ? customTrack || "custom" : track }),
      });
      const data = (await response.json()) as { variant?: { id: string }; error?: string };
      if (!response.ok || !data.variant) throw new Error(data.error || "Could not create the variant.");
      router.push(`/variants/${data.variant.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the variant.");
      setBusy(false);
    }
  }

  return (
    <Card className="p-6">
      <h2 className="font-serif text-xl font-bold">New variant</h2>
      <p className="hint mb-4">A variant is a saved selection of your memory with its own angle.</p>
      <form onSubmit={submit} className="grid gap-4 md:grid-cols-[1fr_180px_auto] md:items-end">
        <Field label="Name">
          <input className="input" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Backend / platform" />
        </Field>
        <Field label="Track">
          <select className="input" value={track} onChange={(e) => setTrack(e.target.value)}>
            {tracks.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </Field>
        <button type="submit" className="btn-primary" disabled={busy || disabled}>
          {busy ? "Creating…" : "Create"}
        </button>
        {track === "custom" ? (
          <div className="md:col-span-3">
            <Field label="Custom track name">
              <input className="input" value={customTrack} onChange={(e) => setCustomTrack(e.target.value)} />
            </Field>
          </div>
        ) : null}
      </form>
      {error ? <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      {disabled ? <p className="mt-3 hint">Add at least one role to your career memory first.</p> : null}
    </Card>
  );
}
