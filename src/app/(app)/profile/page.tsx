import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { ensureProfile, getProfileRow } from "@/lib/guards";
import { ProfileEditor } from "@/components/profile-editor";
import { ProfileSuggestions } from "@/components/profile-suggestions";
import { SnapshotHistory } from "@/components/snapshot-history";
import { ClearMemory } from "@/components/clear-memory";
import { PageHeader } from "@/components/ui";
import { profileCompleteness } from "@/lib/profile";
import { profileSuggestions } from "@/lib/cv-suggestions";
import { listSnapshots, profileCounts } from "@/lib/snapshots";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await getSessionUser();
  if (!user) return null;
  await ensureProfile(user);
  const row = await getProfileRow(user.id);
  if (!row) return null;

  const snapshots = await listSnapshots(user.id);

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
      <ProfileSuggestions suggestions={profileSuggestions(row.data)} />
      {/* Keyed on updatedAt so a restore remounts the editor with the new data. */}
      <ProfileEditor key={row.updatedAt.toISOString()} initialProfile={row.data} />
      <SnapshotHistory
        snapshots={snapshots.map((snapshot) => ({
          id: snapshot.id,
          label: snapshot.label,
          reason: snapshot.reason,
          createdAt: snapshot.createdAt.toISOString(),
          counts: snapshot.counts,
          headline: snapshot.headline,
        }))}
      />
      <ClearMemory counts={profileCounts(row.data)} />
    </div>
  );
}
