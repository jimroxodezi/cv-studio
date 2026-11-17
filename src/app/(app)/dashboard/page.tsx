import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { jobs, variants } from "@/lib/db/schema";
import { getProfileRow } from "@/lib/guards";
import { profileCompleteness } from "@/lib/profile";
import { Badge, Card, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) return null;
  const db = getDb();
  const profileRow = await getProfileRow(user.id);
  const profile = profileRow?.data;
  const [variantRows, jobRows, jobCount, variantCount] = await Promise.all([
    db.select().from(variants).where(eq(variants.userId, user.id)).orderBy(desc(variants.updatedAt)).limit(4),
    db.select().from(jobs).where(eq(jobs.userId, user.id)).orderBy(desc(jobs.updatedAt)).limit(4),
    db.select({ total: sql<number>`count(*)::int` }).from(jobs).where(eq(jobs.userId, user.id)),
    db.select({ total: sql<number>`count(*)::int` }).from(variants).where(eq(variants.userId, user.id)),
  ]);

  const completeness = profile ? profileCompleteness(profile) : 0;
  const firstName = (profile?.identity.fullName || user.name || user.email).split(" ")[0];
  const hasMemory = Boolean(profile?.experience.length);

  return (
    <div>
      <PageHeader
        eyebrow="Dashboard"
        title={`Good to see you, ${firstName}.`}
        description="One career memory feeds every variant and every application. Start with the memory, then tailor."
        actions={
          <>
            <Link href="/profile" className="btn-secondary">
              Edit memory
            </Link>
            <Link href="/jobs" className="btn-primary">
              Tailor a CV
            </Link>
          </>
        }
      />

      {!hasMemory ? (
        <Card className="mb-6 overflow-hidden">
          <div className="grid gap-6 p-6 md:grid-cols-[1.4fr_1fr] md:p-8">
            <div>
              <Badge tone="amber">Start here</Badge>
              <h2 className="mt-3 font-serif text-2xl font-bold text-stone-900">
                Give the studio your professional dump
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-stone-600">
                Paste an old CV, a set of rough notes, or upload a PDF/DOCX. You will get a
                structured career memory back — roles, projects, skills, and the evidence
                behind each claim. You review and edit everything before it is used.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Link href="/profile/import" className="btn-primary">
                  Import a dump
                </Link>
                <Link href="/profile" className="btn-secondary">
                  Fill it in manually
                </Link>
              </div>
            </div>
            <div className="rounded-2xl bg-stone-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">The rule</p>
              <p className="mt-2 font-serif text-lg leading-snug text-stone-800">
                The memory is the only source of facts. The app may select, reorder, and
                reword — it may not invent.
              </p>
            </div>
          </div>
        </Card>
      ) : (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Memory</p>
            <p className="mt-2 font-serif text-3xl font-bold">{completeness}%</p>
            <p className="mt-1 text-xs text-stone-500">
              {profile?.experience.length} roles · {profile?.projects.length} projects
            </p>
          </Card>
          <Card className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Variants</p>
            <p className="mt-2 font-serif text-3xl font-bold">{Number(variantCount[0]?.total ?? 0)}</p>
            <p className="mt-1 text-xs text-stone-500">saved career angles</p>
          </Card>
          <Card className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Applications</p>
            <p className="mt-2 font-serif text-3xl font-bold">{Number(jobCount[0]?.total ?? 0)}</p>
            <p className="mt-1 text-xs text-stone-500">jobs tracked</p>
          </Card>
          <Card className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Next step</p>
            <p className="mt-2 text-sm font-semibold leading-snug text-stone-800">
              {variantRows.length ? "Tailor to a posting" : "Create a variant"}
            </p>
            <Link
              href={variantRows.length ? "/jobs" : "/variants"}
              className="mt-2 inline-block text-xs font-semibold text-amber-800 underline underline-offset-2"
            >
              {variantRows.length ? "Open applications →" : "Build a base CV →"}
            </Link>
          </Card>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-serif text-xl font-bold">Recent variants</h2>
            <Link href="/variants" className="text-xs font-semibold text-amber-800 hover:underline">
              View all
            </Link>
          </div>
          {variantRows.length ? (
            <ul className="divide-y divide-stone-100">
              {variantRows.map((variant) => (
                <li key={variant.id}>
                  <Link href={`/variants/${variant.id}`} className="flex items-center justify-between gap-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-stone-900">{variant.name}</p>
                      <p className="text-xs text-stone-500">
                        {variant.track} · {variant.experienceIds.length} roles
                      </p>
                    </div>
                    <span className="text-stone-300">→</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-stone-500">
              No variants yet.{" "}
              <Link href="/variants" className="font-semibold text-amber-800 underline underline-offset-2">
                Create your first one.
              </Link>
            </p>
          )}
        </Card>

        <Card className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-serif text-xl font-bold">Recent applications</h2>
            <Link href="/jobs" className="text-xs font-semibold text-amber-800 hover:underline">
              View all
            </Link>
          </div>
          {jobRows.length ? (
            <ul className="divide-y divide-stone-100">
              {jobRows.map((job) => (
                <li key={job.id}>
                  <Link href={`/jobs/${job.id}`} className="flex items-center justify-between gap-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-stone-900">
                        {job.company || "Untitled company"} — {job.role || "role"}
                      </p>
                      <p className="text-xs text-stone-500">
                        {job.status} · updated {job.updatedAt.toLocaleDateString()}
                      </p>
                    </div>
                    <span className="text-stone-300">→</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-stone-500">
              No applications yet.{" "}
              <Link href="/jobs" className="font-semibold text-amber-800 underline underline-offset-2">
                Tailor your first CV.
              </Link>
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
