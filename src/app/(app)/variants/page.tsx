import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { variants } from "@/lib/db/schema";
import { ensureProfile } from "@/lib/guards";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { NewVariantForm } from "@/components/new-variant-form";

export const dynamic = "force-dynamic";

export default async function VariantsPage() {
  const user = await getSessionUser();
  if (!user) return null;
  const profile = await ensureProfile(user);
  const rows = await getDb()
    .select()
    .from(variants)
    .where(eq(variants.userId, user.id))
    .orderBy(desc(variants.updatedAt));

  return (
    <div>
      <PageHeader
        eyebrow="Career angles"
        title="CV variants"
        description="Each variant is a saved selection of your career memory, with its own summary and section order. Build one, check the PDF, then tailor it to a job."
      />

      {!profile.experience.length ? (
        <div className="mb-6">
          <EmptyState
            title="Your memory needs a role first"
            body="Variants select from the roles, projects, and skills in your career memory. Add or import at least one role, then come back."
            action={
              <Link href="/profile" className="btn-primary">
                Open career memory
              </Link>
            }
          />
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-3">
          {rows.length ? (
            rows.map((variant) => (
              <Card key={variant.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-serif text-xl font-bold text-stone-900">{variant.name}</h2>
                      <Badge tone="amber">{variant.track}</Badge>
                    </div>
                    <p className="mt-1 line-clamp-2 max-w-2xl text-sm text-stone-600">
                      {variant.summary || "No summary override — uses the track positioning from your memory."}
                    </p>
                    <p className="mt-2 text-xs text-stone-500">
                      {variant.experienceIds.length} roles · {variant.projectIds.length} projects ·{" "}
                      {variant.skillGroupIds.length} skill groups · updated{" "}
                      {variant.updatedAt.toLocaleDateString()}
                    </p>
                  </div>
                  <Link href={`/variants/${variant.id}`} className="btn-secondary">
                    Open
                  </Link>
                </div>
              </Card>
            ))
          ) : (
            <Card className="p-6 text-sm text-stone-500">
              No variants yet. Create one on the right, or import a dump and let the studio suggest tracks.
            </Card>
          )}
        </div>
        <div>
          <NewVariantForm disabled={!profile.experience.length} />
        </div>
      </div>
    </div>
  );
}
