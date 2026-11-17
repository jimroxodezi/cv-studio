"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, Field } from "@/components/ui";

export function NewJobForm({
  variants,
  defaultVariantId,
}: {
  variants: Array<{ id: string; name: string; track: string }>;
  defaultVariantId?: string;
}) {
  const router = useRouter();
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [description, setDescription] = useState("");
  const [variantId, setVariantId] = useState(defaultVariantId ?? variants[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/jobs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ company, role, sourceUrl, description, variantId: variantId || null }),
      });
      const data = (await response.json()) as { job?: { id: string }; error?: string };
      if (!response.ok || !data.job) throw new Error(data.error || "Could not create the application.");
      router.push(`/jobs/${data.job.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the application.");
      setBusy(false);
    }
  }

  return (
    <Card className="p-6">
      <h2 className="font-serif text-xl font-bold">New application</h2>
      <p className="hint mb-4">Paste the posting or give a link. Links are fetched server-side; if the site blocks it, paste the text.</p>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Company">
            <input className="input" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Acme" />
          </Field>
          <Field label="Role">
            <input className="input" value={role} onChange={(e) => setRole(e.target.value)} placeholder="Senior backend engineer" />
          </Field>
        </div>
        <Field label="Job link" hint="Optional if you paste the description.">
          <input className="input" type="url" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://…" />
        </Field>
        <Field label="Job description" hint="Paste the full posting for the best keyword matching.">
          <textarea
            className="input min-h-40 text-xs leading-relaxed"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Paste the posting here…"
          />
        </Field>
        <Field label="Start from variant">
          <select className="input" value={variantId} onChange={(e) => setVariantId(e.target.value)}>
            {variants.map((variant) => (
              <option key={variant.id} value={variant.id}>
                {variant.name} ({variant.track})
              </option>
            ))}
          </select>
        </Field>
        {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
        <button type="submit" className="btn-primary" disabled={busy || (!description.trim() && !sourceUrl.trim())}>
          {busy ? "Creating…" : "Create application"}
        </button>
        {busy && sourceUrl.trim() && !description.trim() ? (
          <p className="hint">Fetching the job page…</p>
        ) : null}
      </form>
    </Card>
  );
}
