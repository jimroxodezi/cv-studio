import { redirect } from "next/navigation";
import { desc } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { invites, users } from "@/lib/db/schema";
import { PageHeader } from "@/components/ui";
import { AdminPanel } from "@/components/admin-panel";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/dashboard");

  const db = getDb();
  const [memberRows, inviteRows] = await Promise.all([
    db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(desc(users.createdAt)),
    db.select().from(invites).orderBy(desc(invites.createdAt)).limit(50),
  ]);

  return (
    <div>
      <PageHeader
        eyebrow="Admin"
        title="People & access"
        description="CV Studio is invite-only. Invite friends here; they will get a one-time link and their own private career memory."
      />
      <AdminPanel
        members={memberRows.map((member) => ({ ...member, createdAt: member.createdAt.toISOString() }))}
        invites={inviteRows.map((invite) => ({
          id: invite.id,
          email: invite.email,
          acceptedAt: invite.acceptedAt ? invite.acceptedAt.toISOString() : null,
          expiresAt: invite.expiresAt.toISOString(),
          createdAt: invite.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
