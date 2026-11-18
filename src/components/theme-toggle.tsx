"use client";

import { useSyncExternalStore } from "react";

type Theme = "light" | "dark";

const COOKIE_NAME = "cv-theme";
const listeners = new Set<() => void>();

function readTheme(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

function applyTheme(theme: Theme) {
  const dark = theme === "dark";
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
  document.cookie = `${COOKIE_NAME}=${theme}; path=/; max-age=31536000; samesite=lax`;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", dark ? "#121110" : "#faf7f2");
  // Keep the <meta name="color-scheme"> in step with the toggle, not just on the
  // server render, so iOS does not auto-darken after switching to light.
  const scheme = document.querySelector('meta[name="color-scheme"]');
  if (scheme) scheme.setAttribute("content", dark ? "dark" : "light");
  for (const listener of listeners) listener();
}

/**
 * Explicit theme control. Nothing here reads prefers-color-scheme: the server
 * renders the stored cookie (or light), and this button writes the cookie.
 */
export function ThemeToggle({
  tone = "default",
  className = "",
}: {
  tone?: "default" | "panel";
  className?: string;
}) {
  const theme = useSyncExternalStore(subscribe, readTheme, () => "light" as Theme);

  function toggle() {
    applyTheme(theme === "dark" ? "light" : "dark");
  }

  const label = theme === "dark" ? "Switch to light mode" : "Switch to dark mode";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className={`inline-flex size-10 shrink-0 items-center justify-center rounded-full border transition md:size-9 ${
        tone === "panel"
          ? "border-[var(--rail-border)] bg-[var(--rail-hover)] text-[var(--rail-muted)] hover:text-[var(--rail-ink)]"
          : "border-[var(--border)] bg-[var(--surface)] text-[var(--color-stone-600)] shadow-sm hover:bg-[var(--surface-soft)] hover:text-[var(--color-stone-900)]"
      } ${className}`}
    >
      {theme === "dark" ? (
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <circle cx="12" cy="12" r="4.2" />
          <path
            d="M12 2.6v2.2M12 19.2v2.2M4.3 4.3l1.6 1.6M18.1 18.1l1.6 1.6M2.6 12h2.2M19.2 12h2.2M4.3 19.7l1.6-1.6M18.1 5.9l1.6-1.6"
            strokeLinecap="round"
          />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M20 14.4A8.2 8.2 0 0 1 9.6 4a8.4 8.4 0 1 0 10.4 10.4Z" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}
