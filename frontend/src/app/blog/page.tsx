"use client";

import Link from "next/link";
import { PublicShell } from "@/components/public-shell";

const BLOG_POSTS = [
  { day: "19", mon: "Mar", title: "PVARA issues guidance on blockchain analytics requirements for NOC applicants", desc: "New clarification from PVARA on what constitutes adequate blockchain analytics for NOC applications.", tags: ["Regulatory", "PVARA"] },
  { day: "15", mon: "Mar", title: "CIP Platform v2.1 — Enhanced ISAR workflow and batch screening", desc: "New 4-step ISAR creation wizard, CSV batch screening with progress tracking.", tags: ["Product Update", "v2.1"] },
  { day: "10", mon: "Mar", title: "Understanding Pakistan's Virtual Assets Act 2026", desc: "A comprehensive breakdown of the regulatory obligations under the new Act.", tags: ["Regulatory", "Guide"] },
];

export default function BlogPage() {
  return (
    <PublicShell>
      <div className="max-w-[1100px] mx-auto px-6 pt-24 pb-12">
        <Link href="/" className="text-[0.68rem] text-muted-foreground hover:text-foreground mb-4 inline-block">
          Home › Blog
        </Link>
        <div className="mb-8">
          <h1 className="text-[1.45rem] font-extrabold tracking-tight mb-1">Blog & Updates</h1>
          <p className="text-[0.78rem] text-muted-foreground">
            Regulatory developments, platform updates, and compliance insights for Pakistan&apos;s VASP ecosystem.
          </p>
        </div>
        <div className="space-y-3">
          {BLOG_POSTS.map((b, i) => (
            <article
              key={i}
              className="flex gap-4 p-5 border border-border rounded-[16px] bg-card hover:border-border/80 transition-colors"
            >
              <div className="w-12 shrink-0 text-center py-2">
                <div className="text-[1.4rem] font-extrabold leading-none">{b.day}</div>
                <div className="text-[0.6rem] text-muted-foreground uppercase tracking-wider">{b.mon}</div>
              </div>
              <div className="flex-1">
                <h2 className="text-[0.88rem] font-bold mb-1">{b.title}</h2>
                <p className="text-[0.7rem] text-muted-foreground leading-relaxed">{b.desc}</p>
                <div className="flex gap-1 mt-2">
                  {b.tags.map((t) => (
                    <span key={t} className="text-[0.55rem] font-semibold px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </PublicShell>
  );
}
