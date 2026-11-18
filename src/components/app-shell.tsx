import Link from "next/link";
import type { ReactNode } from "react";
import { LogoutButton } from "@/components/logout-button";
import { SidebarNav } from "@/components/sidebar-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import type { UserRow } from "@/lib/db/schema";

export function AppShell({ user, children }: { user: UserRow; children: ReactNode }) {
  return (
    <div className="min-h-screen md:flex">
      {/* Desktop rail. Hidden on phones; the sticky header carries the same
          navigation there. */}
      <aside className="hidden bg-[var(--rail)] md:sticky md:top-0 md:flex md:h-screen md:w-64 md:shrink-0 md:flex-col md:border-r md:border-[var(--rail-border)] md:p-5">
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-lg bg-amber-500 font-serif text-lg font-bold text-stone-950">
            C
          </span>
          <span>
            <span className="block font-serif text-lg font-bold leading-none text-[var(--rail-ink)]">CV Studio</span>
            <span className="mt-1 block text-[10px] uppercase tracking-[0.2em] text-[var(--rail-muted)]">
              career memory
            </span>
          </span>
        </Link>

        <div className="mt-8 flex-1">
          <SidebarNav admin={user.role === "admin"} />
        </div>

        <div className="border-t border-[var(--rail-border)] pt-4">
          <p className="truncate text-sm font-medium text-[var(--rail-ink)]">{user.name || "Your account"}</p>
          <p className="truncate text-xs text-[var(--rail-muted)]">{user.email}</p>
          <div className="mt-3">
            <LogoutButton />
          </div>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--surface)] md:border-0 md:bg-transparent">
          <div className="flex items-center justify-between gap-3 px-4 py-3 md:justify-end md:px-10 md:py-4">
            <Link href="/dashboard" className="flex min-w-0 items-center gap-2 md:hidden">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-amber-500 font-serif text-lg font-bold text-stone-950">
                C
              </span>
              <span className="truncate font-serif text-lg font-bold">CV Studio</span>
            </Link>
            <div className="flex shrink-0 items-center gap-3">
              <div className="md:hidden">
                <LogoutButton tone="default" />
              </div>
              <ThemeToggle />
            </div>
          </div>
          <div className="border-t border-[var(--border)] px-2 pb-1 md:hidden">
            <SidebarNav admin={user.role === "admin"} />
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl px-4 pb-12 pt-6 md:px-10 md:py-10">{children}</main>
      </div>
    </div>
  );
}
