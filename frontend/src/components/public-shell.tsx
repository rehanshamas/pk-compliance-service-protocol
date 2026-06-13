"use client";

import { PublicHeader } from "@/components/public-header";
import { PublicFooter } from "@/components/public-footer";

/** Wraps public pages with header + footer. Footer always sticks to bottom via flex. */
export function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background relative">
      {/* Pakistani green stripe — matches cip-public-pages.html */}
      <div className="pk-stripe" />
      <PublicHeader />
      <main className="flex-1 flex flex-col relative z-10">{children}</main>
      <PublicFooter />
    </div>
  );
}
