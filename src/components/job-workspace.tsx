"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { JobAnalysis, TailorResult } from "@/lib/profile";
import { Badge, Card, Field } from "@/components/ui";

type JobData = {
  id: string;
  company: string;
  role: string;
  sourceUrl: string;
  description: string;
  notes: string;
  status: string;
  analysis: JobAnalysis | null;
  result: TailorResult | null;
};

type VersionData = {
  id: string;
  label: string;
  pageCount: number;
  warnings: string[];
  createdAt: string;
};

export function JobWorkspace({
  job,
  variants,
  versions,
  defaultVariantId,
}: {
  job: JobData;
  variants: Array<{ id: string; name: string; track: string }>;
  versions: VersionData[];
  defaultVariantId?: string;
}) {
  const router = useRouter();
  const [company, setCompany] = useState(job.company);
  const [role, setRole] = useState(job.role);
  const [sourceUrl, setSourceUrl] = useState(job.sourceUrl);
  const [description, setDescription] = useState(job.description);
  const [notes, setNotes] = useState(job.notes);
  const [variantId, setVariantId] = useState(defaultVariantId ?? variants[0]?.id ?? "");
  const [busy, setBusy] = useState<"" | "save" | "fetch" | "tailor">("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [analysis, setAnalysis] = useState<JobAnalysis | null>(job.analysis);
  const [result, setResult] = useState<TailorResult | null>(job.result);
  const [warnings, setWarnings] = useState<string[]>(versions[0]?.warnings ?? []);
  const [documentId, setDocumentId] = useState(versions[0]?.id ?? "");
  const [pageCount, setPageCount] = useState(versions[0]?.pageCount ?? 0);
  const [showFullDescription, setShowFullDescription] = useState(false);

  async function save(): Promise<boolean> {
    setBusy("save");
    setError("");
    setStatus("");
    try {
      const response = await fetch(`/api/jobs/${job.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ company, role, sourceUrl, description, notes }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Could not save.");
      setStatus("Saved.");
      router.refresh();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
      return false;
    } finally {
      setBusy("");
    }
  }

  async function fetchLink() {
    if (!sourceUrl.trim()) {
      setError("Add a job link first.");
      return;
    }
    setBusy("fetch");
    setError("");
    setStatus("");
    try {
      const response = await fetch(`/api/jobs/${job.id}/fetch`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: sourceUrl }),
      });
      const data = (await response.json()) as { text?: string; title?: string; error?: string };
      if (!response.ok || !data.text) throw new Error(data.error || "Could not fetch that page.");
      setDescription(data.text);
      if (!role && data.title) setRole(data.title.slice(0, 160));
      setStatus("Job text fetched. Review it, then tailor.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not fetch that page.");
    } finally {
      setBusy("");
    }
  }

  async function tailor() {
    setBusy("tailor");
    setError("");
    setStatus("");
    try {
      const saved = await fetch(`/api/jobs/${job.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ company, role, sourceUrl, description, notes }),
      });
      if (!saved.ok) {
        const data = (await saved.json()) as { error?: string };
        throw new Error(data.error || "Could not save the application first.");
      }
      setBusy("tailor");
      const response = await fetch(`/api/jobs/${job.id}/tailor`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ variantId: variantId || undefined, notes }),
      });
      const data = (await response.json()) as {
        documentId?: string;
        pageCount?: number;
        warnings?: string[];
        analysis?: JobAnalysis;
        keywordCoverage?: TailorResult["keywordCoverage"];
        gaps?: string[];
        notes?: string;
        model?: string;
        error?: string;
      };
      if (!response.ok || !data.documentId) throw new Error(data.error || "Could not tailor the CV.");
      setDocumentId(data.documentId);
      setPageCount(data.pageCount ?? 0);
      setWarnings(data.warnings ?? []);
      setAnalysis(data.analysis ?? null);
      setResult((current) => ({
        analysis: data.analysis ?? current?.analysis ?? ({} as JobAnalysis),
        document: current?.document ?? {
          summary: "",
          skills: [],
          experience: [],
          projects: [],
          educationIds: [],
          sectionOrder: ["summary", "skills", "experience", "projects", "education"],
        },
        keywordCoverage: data.keywordCoverage ?? [],
        gaps: data.gaps ?? [],
        notes: data.notes ?? "",
      }));
      setStatus(`Tailored with ${data.model ?? "the configured model"}.`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not tailor the CV.");
    } finally {
      setBusy("");
    }
  }

  const coverage = result?.keywordCoverage ?? [];
  const gaps = result?.gaps ?? analysis?.gaps ?? [];

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_480px]">
      <div className="space-y-4">
        <Card className="p-5">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Company">
              <input className="input" value={company} onChange={(e) => setCompany(e.target.value)} />
            </Field>
            <Field label="Role">
              <input className="input" value={role} onChange={(e) => setRole(e.target.value)} />
            </Field>
          </div>
          <div className="mt-3">
            <Field label="Job link">
              <div className="flex gap-2">
                <input className="input" type="url" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} />
                <button type="button" className="btn-secondary shrink-0" onClick={fetchLink} disabled={busy !== ""}>
                  {busy === "fetch" ? "Fetching…" : "Fetch text"}
                </button>
              </div>
            </Field>
          </div>
          <div className="mt-3">
            <div className="flex items-center justify-between">
              <span className="label mb-0">Job description</span>
              <button
                type="button"
                className="text-xs font-semibold text-amber-800 hover:underline"
                onClick={() => setShowFullDescription((value) => !value)}
              >
                {showFullDescription ? "Collapse" : "Expand"}
              </button>
            </div>
            <textarea
              className={`input mt-1 text-xs leading-relaxed ${showFullDescription ? "min-h-80" : "min-h-32"}`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <p className="mt-1 text-xs text-stone-500">{description.length.toLocaleString()} characters</p>
          </div>
          <div className="mt-3">
            <Field label="Anything to emphasise?" hint="Optional. Passed to the model as an extra instruction.">
              <textarea className="input min-h-16" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className="btn-primary" onClick={tailor} disabled={busy !== "" || !description.trim()}>
              {busy === "tailor" ? "Tailoring…" : "Tailor CV to this job"}
            </button>
            <button type="button" className="btn-secondary" onClick={save} disabled={busy !== ""}>
              {busy === "save" ? "Saving…" : "Save"}
            </button>
          </div>
          {busy === "tailor" ? (
            <p className="mt-3 text-xs text-stone-500">
              Reading the posting, selecting evidence, rewriting bullets, then compiling LaTeX.
              This usually takes 30–90 seconds.
            </p>
          ) : null}
          {status ? <p className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{status}</p> : null}
          {error ? <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
        </Card>

        <Card className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-serif text-lg font-bold">Tailoring brief</h2>
              <p className="hint">Choose the variant the model should start from.</p>
            </div>
            <select className="input max-w-xs" value={variantId} onChange={(e) => setVariantId(e.target.value)}>
              {variants.map((variant) => (
                <option key={variant.id} value={variant.id}>
                  {variant.name} ({variant.track})
                </option>
              ))}
            </select>
          </div>
          {analysis ? (
            <div className="mt-4 space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge tone="amber">{analysis.track}</Badge>
                {analysis.seniority ? <Badge>{analysis.seniority}</Badge> : null}
                <Badge tone={gaps.length ? "red" : "green"}>{gaps.length} gaps</Badge>
                <Badge tone="green">{coverage.length} matched</Badge>
              </div>
              {analysis.angle ? <p className="text-sm leading-relaxed text-stone-700">{analysis.angle}</p> : null}
              {analysis.keywords.length ? (
                <div>
                  <p className="label">Keywords</p>
                  <div className="flex flex-wrap gap-1.5">
                    {analysis.keywords.slice(0, 24).map((keyword) => (
                      <span key={keyword} className="pill border-stone-200 bg-stone-50 text-stone-600">
                        {keyword}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="mt-3 text-sm text-stone-500">No analysis yet. Tailor the CV to extract requirements and gaps.</p>
          )}
        </Card>

        {coverage.length ? (
          <Card className="p-5">
            <h2 className="font-serif text-lg font-bold">Requirement coverage</h2>
            <p className="hint mb-3">Only claims your career memory can evidence are listed here.</p>
            <ul className="divide-y divide-stone-100">
              {coverage.map((item) => (
                <li key={`${item.keyword}-${item.where}`} className="py-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-stone-900">{item.keyword}</span>
                    {item.where ? <Badge tone="blue">{item.where}</Badge> : null}
                  </div>
                  <p className="mt-0.5 text-xs leading-relaxed text-stone-500">{item.evidence}</p>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}

        {gaps.length ? (
          <Card className="border-amber-200 bg-amber-50/60 p-5">
            <h2 className="font-serif text-lg font-bold text-amber-900">Gaps — do not fake these</h2>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-amber-900">
              {gaps.map((gap) => (
                <li key={gap}>{gap}</li>
              ))}
            </ul>
          </Card>
        ) : null}

        {result?.notes ? (
          <Card className="p-5">
            <details>
              <summary className="cursor-pointer font-serif text-lg font-bold">Model notes</summary>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-stone-600">{result.notes}</p>
            </details>
          </Card>
        ) : null}

        <Card className="p-5">
          <h2 className="font-serif text-lg font-bold">Versions</h2>
          <p className="hint mb-3">Every build is kept. Preview any version without losing the current one.</p>
          {versions.length ? (
            <ul className="divide-y divide-stone-100">
              {versions.map((version) => (
                <li key={version.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setDocumentId(version.id);
                      setPageCount(version.pageCount);
                      setWarnings(version.warnings);
                    }}
                    className={`text-left text-sm ${documentId === version.id ? "font-bold text-stone-900" : "text-stone-600 hover:text-stone-900"}`}
                  >
                    {new Date(version.createdAt).toLocaleString()}
                    <span className="ml-2 text-xs font-normal text-stone-400">
                      {version.pageCount} page{version.pageCount === 1 ? "" : "s"}
                    </span>
                  </button>
                  <div className="flex gap-1.5">
                    <a className="btn-secondary px-2 py-1 text-xs" href={`/api/documents/${version.id}?format=pdf`} target="_blank" rel="noreferrer">
                      PDF
                    </a>
                    <a className="btn-secondary px-2 py-1 text-xs" href={`/api/documents/${version.id}?format=tex`} target="_blank" rel="noreferrer">
                      .tex
                    </a>
                    <a className="btn-secondary px-2 py-1 text-xs" href={`/api/documents/${version.id}?format=txt`} target="_blank" rel="noreferrer">
                      ATS
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-stone-500">Nothing built yet.</p>
          )}
        </Card>
      </div>

      <div className="xl:sticky xl:top-6 xl:self-start">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-stone-100 p-4">
            <div>
              <h2 className="font-serif text-lg font-bold">Latest PDF</h2>
              <p className="text-xs text-stone-500">
                {documentId ? `${pageCount} page${pageCount === 1 ? "" : "s"}` : "Tailor to build a PDF."}
              </p>
            </div>
            {documentId ? (
              <a className="btn-primary px-3 py-1.5 text-xs" href={`/api/documents/${documentId}?format=pdf&download=1`}>
                Download
              </a>
            ) : null}
          </div>
          {documentId ? (
            <iframe key={documentId} title="Tailored CV preview" src={`/api/documents/${documentId}`} className="h-[760px] w-full bg-stone-100" />
          ) : (
            <div className="flex h-72 flex-col items-center justify-center gap-2 p-6 text-center">
              <span className="text-3xl text-stone-300">✎</span>
              <p className="text-sm text-stone-500">
                The tailored PDF appears here. You will also get the LaTeX source and the ATS
                text extract.
              </p>
            </div>
          )}
          {warnings.length ? (
            <div className="border-t border-amber-200 bg-amber-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">Check before sending</p>
              <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-amber-900">
                {warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </Card>
        {documentId ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <a className="btn-secondary text-xs" href={`/api/documents/${documentId}?format=tex&download=1`}>
              Download .tex
            </a>
            <a className="btn-secondary text-xs" href={`/api/documents/${documentId}?format=txt&download=1`}>
              Download ATS text
            </a>
          </div>
        ) : null}
      </div>
    </div>
  );
}
