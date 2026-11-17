"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CoverLetter } from "@/lib/profile";
import { Card, Field } from "@/components/ui";

export type LetterVersion = {
  id: string;
  label: string;
  warnings: string[];
  createdAt: string;
  letter: CoverLetter | null;
};

export function CoverLetterPanel({
  jobId,
  hasDescription,
  versions,
}: {
  jobId: string;
  hasDescription: boolean;
  versions: LetterVersion[];
}) {
  const router = useRouter();
  const latest = versions[0] ?? null;
  const latestLetter = latest?.letter ?? null;

  const [documentId, setDocumentId] = useState(latest?.id ?? "");
  const [letter, setLetter] = useState<CoverLetter | null>(latestLetter);
  const [subject, setSubject] = useState(latestLetter?.subject ?? "");
  const [greeting, setGreeting] = useState(latestLetter?.greeting ?? "");
  const [closing, setClosing] = useState(latestLetter?.closing ?? "Sincerely,");
  const [body, setBody] = useState((latestLetter?.paragraphs ?? []).join("\n\n"));
  const [steer, setSteer] = useState("");
  const [warnings, setWarnings] = useState<string[]>(latest?.warnings ?? []);
  const [busy, setBusy] = useState<"" | "write" | "rebuild">("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [rev, setRev] = useState(0);

  function load(next: CoverLetter) {
    setLetter(next);
    setSubject(next.subject);
    setGreeting(next.greeting);
    setClosing(next.closing || "Sincerely,");
    setBody(next.paragraphs.join("\n\n"));
  }

  async function write() {
    setBusy("write");
    setError("");
    setStatus("");
    try {
      const response = await fetch(`/api/jobs/${jobId}/cover-letter`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ steer: steer.trim() || undefined }),
      });
      const data = (await response.json()) as {
        documentId?: string;
        letter?: CoverLetter;
        warnings?: string[];
        model?: string;
        repaired?: boolean;
        error?: string;
      };
      if (!response.ok || !data.documentId || !data.letter) {
        throw new Error(data.error || "Could not write the letter.");
      }
      setDocumentId(data.documentId);
      load(data.letter);
      setWarnings(data.warnings ?? []);
      setRev((value) => value + 1);
      setStatus(
        `${data.repaired ? "Rewritten once to strip template phrasing. " : ""}Written with ${data.model ?? "the configured model"}.`,
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not write the letter.");
    } finally {
      setBusy("");
    }
  }

  async function rebuild() {
    if (!documentId) return;
    setBusy("rebuild");
    setError("");
    setStatus("");
    try {
      const paragraphs = body
        .split(/\n{2,}/)
        .map((entry) => entry.trim())
        .filter(Boolean);
      const response = await fetch(`/api/jobs/${jobId}/cover-letter`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ documentId, subject, greeting, closing, paragraphs }),
      });
      const data = (await response.json()) as {
        letter?: CoverLetter;
        warnings?: string[];
        error?: string;
      };
      if (!response.ok || !data.letter) throw new Error(data.error || "Could not rebuild the PDF.");
      load(data.letter);
      setWarnings(data.warnings ?? []);
      setRev((value) => value + 1);
      setStatus("PDF rebuilt from your edits.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not rebuild the PDF.");
    } finally {
      setBusy("");
    }
  }

  const wordCount = body.split(/\s+/).filter(Boolean).length;

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-serif text-lg font-bold">Cover letter</h2>
          <p className="hint">
            Written from the posting and your memory, then checked for template language. Edit any
            line and rebuild the PDF.
          </p>
        </div>
        <button
          type="button"
          className="btn-primary shrink-0"
          onClick={write}
          disabled={busy !== "" || !hasDescription}
        >
          {busy === "write" ? "Writing…" : letter ? "Write another" : "Write cover letter"}
        </button>
      </div>

      {!hasDescription ? (
        <p className="mt-3 text-sm text-stone-500">Add the job description first.</p>
      ) : null}

      {busy === "write" ? (
        <p className="mt-3 text-xs text-stone-500">
          Reading the posting, choosing a structure, drafting, then checking the phrasing. About 30
          seconds.
        </p>
      ) : null}

      {status ? <p className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{status}</p> : null}
      {error ? <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

      {!letter ? (
        <div className="mt-4 rounded-xl border border-dashed border-stone-300 p-6 text-center">
          <p className="text-sm text-stone-500">
            Most postings ask for one. This writes a short, specific letter that argues from your own
            record instead of restating your CV.
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          {letter.angle ? (
            <div className="rounded-lg bg-stone-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                The argument{letter.structure ? ` · ${letter.structure}` : ""}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-stone-700">{letter.angle}</p>
            </div>
          ) : null}

          {warnings.length ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
                Check before sending
              </p>
              <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-amber-900">
                {warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Subject line">
              <input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} />
            </Field>
            <Field label="Salutation">
              <input className="input" value={greeting} onChange={(e) => setGreeting(e.target.value)} />
            </Field>
          </div>

          <Field
            label="Letter"
            hint={`${wordCount} words. Separate paragraphs with a blank line. A good letter is 220–320.`}
          >
            <textarea
              className="input min-h-72 text-sm leading-relaxed"
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </Field>

          <div className="flex flex-wrap items-end gap-3">
            <div className="w-40">
              <Field label="Sign-off">
                <input className="input" value={closing} onChange={(e) => setClosing(e.target.value)} />
              </Field>
            </div>
            <button type="button" className="btn-secondary" onClick={rebuild} disabled={busy !== ""}>
              {busy === "rebuild" ? "Rebuilding…" : "Rebuild PDF"}
            </button>
            {documentId ? (
              <>
                <a className="btn-secondary" href={`/api/documents/${documentId}?format=pdf&download=1`}>
                  Download PDF
                </a>
                <a className="btn-secondary" href={`/api/documents/${documentId}?format=tex&download=1`}>
                  .tex
                </a>
              </>
            ) : null}
          </div>

          <details className="rounded-lg bg-stone-50 p-3">
            <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-stone-500">
              Try a different angle
            </summary>
            <div className="mt-2">
              <Field
                label="Direction"
                hint="Optional. Steers the next draft, for example: lead with the audit work, keep it under 200 words."
              >
                <textarea
                  className="input min-h-16"
                  value={steer}
                  onChange={(e) => setSteer(e.target.value)}
                />
              </Field>
              <button
                type="button"
                className="btn-secondary mt-2"
                onClick={write}
                disabled={busy !== "" || !hasDescription}
              >
                {busy === "write" ? "Writing…" : "Write with this direction"}
              </button>
            </div>
          </details>

          {letter.evidence.length ? (
            <details className="rounded-lg bg-stone-50 p-3">
              <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-stone-500">
                Facts this letter uses
              </summary>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-stone-600">
                {letter.evidence.map((fact) => (
                  <li key={fact}>{fact}</li>
                ))}
              </ul>
            </details>
          ) : null}

          {documentId ? (
            <div className="overflow-hidden rounded-xl border border-stone-200">
              <iframe
                key={`${documentId}-${rev}`}
                title="Cover letter preview"
                src={`/api/documents/${documentId}?v=${rev}`}
                className="h-[560px] w-full bg-stone-100"
              />
            </div>
          ) : null}
        </div>
      )}
    </Card>
  );
}
