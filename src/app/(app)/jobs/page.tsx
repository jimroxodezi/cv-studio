import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { jobs, variants } from "@/lib/db/schema";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { NewJobForm } from "@/components/new-job-form";

export const dynamic = "force-dynamic";

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ fromVariant?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) return null;
  const { fromVariant } = await searchParams;
  const db = getDb();
  const [jobRows, variantRows] = await Promise.all([
    db.select().from(jobs).where(eq(jobs.userId, user.id)).orderBy(desc(jobs.updatedAt)),
    db.select().from(variants).where(eq(variants.userId, user.id)).orderBy(desc(variants.updatedAt)),
  ]);

  return (
    <div>
      <PageHeader
        eyebrow="Applications"
        title="Job applications"
        description="Each application keeps the posting, the keyword analysis, the gaps, the PDF, and the LaTeX source. Iterate without losing the version you already sent."
      />

      {!variantRows.length ? (
        <div className="mb-6">
          <EmptyState
            title="Create a variant first"
            body="Applications start from one of your CV variants. Build a base variant, then tailor it to a specific posting."
            action={
              <Link href="/variants" className="btn-primary">
                Go to variants
              </Link>
            }
          />
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
        <div className="space-y-3">
          {jobRows.length ? (
            jobRows.map((job) => (
              <Card key={job.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-serif text-xl font-bold text-stone-900">
                        {job.company || "Untitled company"}
                      </h2>
                      <Badge tone={job.status === "tailored" ? "green" : "neutral"}>{job.status}</Badge>
                    </div>
                    <p className="text-sm font-medium text-stone-700">{job.role || "Untitled role"}</p>
                    <p className="mt-1 line-clamp-2 max-w-2xl text-xs leading-relaxed text-stone-500">
                      {job.description.slice(0, 260)}
                    </p>
                    <p className="mt-2 text-xs text-stone-400">
                      Updated {job.updatedAt.toLocaleDateString()}
                      {job.analysis?.track ? ` · ${job.analysis.track}` : ""}
                    </p>
                  </div>
                  <Link href={`/jobs/${job.id}`} className="btn-secondary">
                    Open
                  </Link>
                </div>
              </Card>
            ))
          ) : (
            <Card className="p-6 text-sm text-stone-500">
              No applications yet. Add the first posting on the right.
            </Card>
          )}
        </div>
        <div>
          <NewJobForm
            variants={variantRows.map((variant) => ({ id: variant.id, name: variant.name, track: variant.track }))}
            defaultVariantId={fromVariant}
          />
        </div>
      </div>
    </div>
  );
}
