import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import "./globals.css";

export const metadata: Metadata = {
  title: "CV Studio — one career memory, every application",
  description:
    "Turn your professional history into a career memory, keep several CV variants, and tailor a LaTeX CV to any job.",
  applicationName: "CV Studio",
};

export async function generateViewport(): Promise<Viewport> {
  const theme = (await cookies()).get("cv-theme")?.value === "dark" ? "dark" : "light";
  // The <meta name="color-scheme"> tag is what stops iOS Safari and Brave from
  // "auto-darkening" a light page when the device is in dark mode. The CSS
  // `color-scheme` property alone is not enough for iOS.
  return {
    themeColor: theme === "dark" ? "#121110" : "#faf7f2",
    colorScheme: theme === "dark" ? "dark" : "light",
  };
}

/**
 * The theme is a cookie, read on the server, so the correct class is in the
 * first HTML. It is never inferred from the operating system: no cookie means
 * light. The toggle writes the cookie and updates the DOM in place.
 */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = (await cookies()).get("cv-theme")?.value === "dark" ? "dark" : "light";

  return (
    <html
      lang="en"
      className={theme === "dark" ? "dark" : undefined}
      data-theme={theme}
      suppressHydrationWarning
    >
      <body>{children}</body>
    </html>
  );
}
