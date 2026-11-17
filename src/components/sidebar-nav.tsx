"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/dashboard", label: "Dashboard", glyph: "◈" },
  { href: "/profile", label: "Career memory", glyph: "▤" },
  { href: "/variants", label: "CV variants", glyph: "⧉" },
  { href: "/jobs", label: "Applications", glyph: "✎" },
  { href: "/settings", label: "Settings", glyph: "⚙" },
];

export function SidebarNav({ admin }: { admin?: boolean }) {
  const pathname = usePathname();
  const all = admin ? [...items, { href: "/admin", label: "Admin", glyph: "⌘" }] : items;

  return (
    <nav className="flex gap-1 overflow-x-auto pb-1 md:flex-col md:overflow-visible md:pb-0">
      {all.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex shrink-0 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
              active
                ? "bg-amber-500/15 text-amber-200"
                : "text-stone-400 hover:bg-white/5 hover:text-stone-100"
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
