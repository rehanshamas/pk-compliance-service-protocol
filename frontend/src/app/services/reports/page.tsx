"use client";

import Link from "next/link";
import {
  ArrowLeft,
  FileText,
  Workflow,
  FileCode,
  ClipboardList,
  BarChart3,
  Archive,
  CheckCircle2,
} from "lucide-react";

export default function ReportsServicePage() {
  return (
    <>
      {/* Back link */}
      <div className="container max-w-3xl mx-auto px-6 pt-24 pb-4">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </Link>
      </div>

      {/* Hero */}
      <section className="px-6 pb-8">
        <div className="container max-w-3xl mx-auto">
          <div className="rounded-lg border bg-card p-6 flex items-center gap-5">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <FileText className="h-7 w-7 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">
                Reports &amp; Filings
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                ISAR workflow, STR/CTR generation, Form A5, Form A6 —
                regulatory-ready.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Capabilities */}
      <section className="px-6 pb-16">
        <div className="container max-w-3xl mx-auto space-y-10">
          {/* ISAR Workflow Engine */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Workflow className="h-5 w-5 text-primary shrink-0" />
              <h2 className="text-lg font-semibold">ISAR Workflow Engine</h2>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Internal Suspicious Activity Reports matching Form A7 structure.
              Staff submit through the platform, routed to the MLRO with full
              case context. 4-step wizard: Subject &rarr; Suspicion &rarr;
              Evidence &rarr; Review.
            </p>
          </div>

          {/* goAML Pre-Formatting */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <FileCode className="h-5 w-5 text-primary shrink-0" />
              <h2 className="text-lg font-semibold">goAML Pre-Formatting</h2>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              STR and CTR data packages formatted to FMU&apos;s goAML schema
              (XML). The VASP&apos;s reporting officer reviews and submits
              through goAML directly.
            </p>
          </div>

          {/* Form A5 */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <ClipboardList className="h-5 w-5 text-primary shrink-0" />
              <h2 className="text-lg font-semibold">
                Form A5 — Outsourcing Register
              </h2>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Pre-built outsourcing declaration templates documenting functions
              outsourced to CIP, SLAs, audit rights, and data protection
              clauses. Ready for PVARA inspection.
            </p>
          </div>

          {/* Form A6 */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <BarChart3 className="h-5 w-5 text-primary shrink-0" />
              <h2 className="text-lg font-semibold">
                Form A6 — Annual Return
              </h2>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Auto-compiled CDD metrics, transaction monitoring stats, and
              STR/CTR statistics matching Form A6 sections. MLRO and CEO review
              and sign.
            </p>
          </div>

          {/* 7-Year Record Retention */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Archive className="h-5 w-5 text-primary shrink-0" />
              <h2 className="text-lg font-semibold">
                7-Year Record Retention
              </h2>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Encrypted, tamper-evident, auditable storage of all records. Meets
              Reg.&nbsp;13.1 (minimum 7-year retention) and Reg.&nbsp;13.2
              (secure, auditable, retrievable).
            </p>
          </div>

          {/* Regulation references */}
          <div className="rounded-lg border bg-muted/40 p-5">
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              Regulatory References
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Reg.&nbsp;12 (Monitoring / STRs) &middot; Reg.&nbsp;13
              (Recordkeeping) &middot; Reg.&nbsp;14 (Outsourcing) &middot;
              Reg.&nbsp;18 (Annual Return) &middot; PVARA NOC Regulations 2025
              &middot; Virtual Assets Act 2026
            </p>
          </div>

          {/* CTA */}
          <div className="pt-4">
            <Link
              href="/apply"
              className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Apply for CIP
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
