"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

const items = [
  { href: "/dashboard", label: "Dashboard", glyph: "◈" },
  { href: "/profile", label: "Career memory", glyph: "▤" },
  { href: "/variants", label: "CV variants", glyph: "⧉" },
  { href: "/jobs", label: "Applications", glyph: "✎" },
  { href: "/settings", label: "Settings", glyph: "⚙" },
];

export function SidebarNav({ admin }: { admin?: boolean }) {
  const pathname = usePathname();
  const nav = useRef<HTMLElement>(null);
  const all = admin ? [...items, { href: "/admin", label: "Admin", glyph: "⌘" }] : items;

  // On a phone the nav is a horizontal scroller. Keep the active item in
  // view when a route changes, so the highlighted tab is never half-clipped.
  useEffect(() => {
    const element = nav.current;
    if (!element || element.scrollWidth <= element.clientWidth) return;
    const active = element.querySelector<HTMLElement>('[data-active="true"]');
    active?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [pathname]);

  return (
    <nav ref={nav} className="no-scrollbar flex gap-1 overflow-x-auto px-2 py-1 md:flex-col md:overflow-visible md:px-0">
      {all.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            data-active={active ? "true" : undefined}
            className={`flex shrink-0 items-center gap-3 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition ${
              active
                ? "bg-[var(--panel-active)] text-[var(--panel-active-ink)]"
                : "text-[var(--panel-muted)] hover:bg-white/5 hover:text-[var(--panel-ink)]"
            }`}
          >
            <span className="w-4 text-center text-xs opacity-70">{item.glyph}</span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
