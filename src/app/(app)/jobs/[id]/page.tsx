import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { documents, variants } from "@/lib/db/schema";
import { getOwnedJob } from "@/lib/guards";
import { PageHeader } from "@/components/ui";
import { JobWorkspace } from "@/components/job-workspace";

export const dynamic = "force-dynamic";

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return null;
  const { id } = await params;
  const db = getDb();
  const [job, variantRows, versionRows] = await Promise.all([
    getOwnedJob(user.id, id),
    db.select().from(variants).where(eq(variants.userId, user.id)).orderBy(desc(variants.updatedAt)),
    db
      .select({
        id: documents.id,
        label: documents.label,
        pageCount: documents.pageCount,
        warnings: documents.warnings,
        createdAt: documents.createdAt,
      })
      .from(documents)
      .where(eq(documents.jobId, id))
      .orderBy(desc(documents.createdAt)),
  ]);

  const orderedVariants = job.variantId
    ? [...variantRows].sort((a, b) => (a.id === job.variantId ? -1 : b.id === job.variantId ? 1 : 0))
    : variantRows;

  return (
    <div>
      <PageHeader
        eyebrow="Application"
        title={job.company ? `${job.company} — ${job.role || "role"}` : job.role || "Application"}
        description="Tailor, inspect the coverage and gaps, then download the PDF and LaTeX. Every build is versioned."
        actions={
          <>
            <Link href="/jobs" className="btn-secondary">
              All applications
            </Link>
            {job.variantId ? (
              <Link href={`/variants/${job.variantId}`} className="btn-secondary">
                Base variant
              </Link>
            ) : null}
          </>
        }
      />
      <JobWorkspace
        job={{
          id: job.id,
          company: job.company,
          role: job.role,
          sourceUrl: job.sourceUrl,
          description: job.description,
          notes: job.notes,
          status: job.status,
          analysis: job.analysis ?? null,
          result: job.result ?? null,
        }}
        variants={orderedVariants.map((variant) => ({ id: variant.id, name: variant.name, track: variant.track }))}
        versions={versionRows.map((version) => ({
          id: version.id,
          label: version.label,
          pageCount: version.pageCount,
          warnings: version.warnings,
          createdAt: version.createdAt.toISOString(),
        }))}
        defaultVariantId={job.variantId ?? orderedVariants[0]?.id}
      />
    </div>
  );
}
