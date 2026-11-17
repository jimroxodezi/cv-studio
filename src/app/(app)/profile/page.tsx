import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { ensureProfile, getProfileRow } from "@/lib/guards";
import { ProfileEditor } from "@/components/profile-editor";
import { PageHeader } from "@/components/ui";
import { profileCompleteness } from "@/lib/profile";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await getSessionUser();
  if (!user) return null;
  await ensureProfile(user);
  const row = await getProfileRow(user.id);
  if (!row) return null;

  return (
    <div>
      <PageHeader
        eyebrow="Source of truth"
        title="Career memory"
        description={`Everything the studio knows about you. Completeness: ${profileCompleteness(row.data)}%. Keep it factual — the AI may reword this, but it may not add to it.`}
        actions={
          <>
            <Link href="/profile/import" className="btn-secondary">
              Import a dump
            </Link>
            <Link href="/variants" className="btn-primary">
              Build a variant
            </Link>
          </>
        }
      />
      <ProfileEditor initialProfile={row.data} />
    </div>
  );
}
