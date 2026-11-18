"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function LogoutButton({ tone = "panel" }: { tone?: "panel" | "default" }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const className =
    tone === "panel"
      ? "text-xs font-medium text-[var(--panel-muted)] transition hover:text-[var(--panel-ink)]"
      : "text-sm font-medium text-[var(--color-stone-500)] transition hover:text-[var(--color-stone-900)]";

  return (
    <button type="button" onClick={logout} disabled={busy} className={className}>
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}
