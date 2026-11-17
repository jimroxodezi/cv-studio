import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CV Studio — one career memory, every application",
  description:
    "Turn your professional history into a career memory, keep several CV variants, and tailor a LaTeX CV to any job.",
  applicationName: "CV Studio",
};

export const viewport: Viewport = {
  themeColor: "#f6f1e7",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
