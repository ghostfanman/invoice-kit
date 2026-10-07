import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "../globals.css";

export const metadata: Metadata = {
  title: "RepoLaunch",
  description: "Evidence-based repository audit with prioritised tasks and an optional AI launch package.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
