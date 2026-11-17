import Link from "next/link";
import type { ReactNode } from "react";
import { LogoutButton } from "@/components/logout-button";
import { SidebarNav } from "@/components/sidebar-nav";
import type { UserRow } from "@/lib/db/schema";

export function AppShell({ user, children }: { user: UserRow; children: ReactNode }) {
  return (
    <div className="min-h-screen md:flex">
      <aside className="bg-stone-950 text-stone-200 md:sticky md:top-0 md:flex md:h-screen md:w-64 md:shrink-0 md:flex-col md:p-5">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-4 md:block md:border-0 md:px-0 md:pb-8">
          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-lg bg-amber-500 font-serif text-lg font-bold text-stone-950">
              C
            </span>
            <span>
              <span className="block font-serif text-lg font-bold leading-none text-white">CV Studio</span>
              <span className="mt-1 block text-[10px] uppercase tracking-[0.2em] text-stone-500">
                career memory
              </span>
            </span>
          </Link>
        </div>
        <div className="hidden md:mt-2 md:block">
          <SidebarNav admin={user.role === "admin"} />
        </div>
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/10 px-4 py-4 md:mt-auto md:block md:border-0 md:p-0">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-stone-200">{user.name || "Your account"}</p>
            <p className="truncate text-xs text-stone-500">{user.email}</p>
          </div>
          <div className="md:mt-3">
            <LogoutButton />
          </div>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <div className="border-b border-stone-200 bg-white/70 px-4 py-3 md:hidden">
          <SidebarNav admin={user.role === "admin"} />
        </div>
        <main className="mx-auto w-full max-w-6xl px-4 py-8 md:px-10 md:py-12">{children}</main>
      </div>
    </div>
  );
}
