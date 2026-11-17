"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Card, Field } from "@/components/ui";

type Member = { id: string; email: string; name: string; role: string; createdAt: string };
type Invite = { id: string; email: string; acceptedAt: string | null; expiresAt: string; createdAt: string };

export function AdminPanel({
  members,
  invites,
}: {
  members: Member[];
  invites: Invite[];
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [inviteUrl, setInviteUrl] = useState("");
  const [status, setStatus] = useState("");

  async function invite(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setStatus("");
    setInviteUrl("");
    try {
      const response = await fetch("/api/admin/invites", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await response.json()) as { error?: string; inviteUrl?: string; delivered?: boolean };
      if (!response.ok) throw new Error(data.error || "Could not create the invite.");
      setStatus(data.delivered ? `Invite emailed to ${email}.` : `Invite created for ${email}.`);
      if (data.inviteUrl) setInviteUrl(data.inviteUrl);
      setEmail("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the invite.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <div className="space-y-4">
        <Card className="p-6">
          <h2 className="font-serif text-xl font-bold">Members</h2>
          <ul className="mt-3 divide-y divide-stone-100">
            {members.map((member) => (
              <li key={member.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div>
                  <p className="text-sm font-semibold text-stone-900">{member.name || member.email}</p>
                  <p className="text-xs text-stone-500">{member.email}</p>
                </div>
                <Badge tone={member.role === "admin" ? "amber" : "neutral"}>{member.role}</Badge>
              </li>
            ))}
            {!members.length ? <li className="py-3 text-sm text-stone-500">No members yet.</li> : null}
          </ul>
        </Card>

        <Card className="p-6">
          <h2 className="font-serif text-xl font-bold">Invites</h2>
          <ul className="mt-3 divide-y divide-stone-100">
            {invites.map((invite) => (
              <li key={invite.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div>
                  <p className="text-sm font-medium text-stone-900">{invite.email}</p>
                  <p className="text-xs text-stone-500">
                    Created {new Date(invite.createdAt).toLocaleDateString()} · expires{" "}
                    {new Date(invite.expiresAt).toLocaleDateString()}
                  </p>
                </div>
                <Badge tone={invite.acceptedAt ? "green" : "amber"}>
                  {invite.acceptedAt ? "accepted" : "pending"}
                </Badge>
              </li>
            ))}
            {!invites.length ? <li className="py-3 text-sm text-stone-500">No invites yet.</li> : null}
          </ul>
        </Card>
      </div>

      <div>
        <Card className="p-6">
          <h2 className="font-serif text-xl font-bold">Invite someone</h2>
          <p className="hint mb-4">They get a one-time link and create their own account. No shared password.</p>
          <form onSubmit={invite} className="space-y-3">
            <Field label="Email">
              <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <button type="submit" className="btn-primary w-full" disabled={busy}>
              {busy ? "Inviting…" : "Send invite"}
            </button>
          </form>
          {status ? <p className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{status}</p> : null}
          {inviteUrl ? (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              <p className="font-semibold">No email configured — send this link yourself.</p>
              <a href={inviteUrl} className="mt-1 block break-all font-medium underline">
                {inviteUrl}
              </a>
            </div>
          ) : null}
          {error ? <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
        </Card>
      </div>
    </div>
  );
}
