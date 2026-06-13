"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Shield,
  Search,
  UserCheck,
  RefreshCw,
  FileSpreadsheet,
  CheckCircle2,
} from "lucide-react";

export default function ScreeningServicePage() {
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
              <Shield className="h-7 w-7 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">
                Screening &amp; Watchlist
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Real-time sanctions, PEP, and adverse media screening against
                global and Pakistan-specific lists.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Capabilities */}
      <section className="px-6 pb-16">
        <div className="container max-w-3xl mx-auto space-y-10">
          {/* Sanctions / TFS Screening */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Search className="h-5 w-5 text-primary shrink-0" />
              <h2 className="text-lg font-semibold">
                Sanctions / TFS Screening
              </h2>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Real-time screening against UN Security Council consolidated list,
              NACTA domestic designated persons list, OFAC SDN list, EU
              consolidated list, and other configurable sources. Auto-updates as
              lists change.
            </p>
          </div>

          {/* PEP Screening */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <UserCheck className="h-5 w-5 text-primary shrink-0" />
              <h2 className="text-lg font-semibold">PEP Screening</h2>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Global PEP databases covering domestic and foreign politically
              exposed persons, family members, and close associates. Supports
              Reg.&nbsp;10.1(b) EDD requirements.
            </p>
          </div>

          {/* Ongoing Re-Screening */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <RefreshCw className="h-5 w-5 text-primary shrink-0" />
              <h2 className="text-lg font-semibold">Ongoing Re-Screening</h2>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Automated periodic re-screening of the entire customer base
              against updated lists. Critical because sanctions lists change
              frequently and Reg.&nbsp;12.1 requires screening of all customers.
            </p>
          </div>

          {/* Batch Screening */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="h-5 w-5 text-primary shrink-0" />
              <h2 className="text-lg font-semibold">Batch Screening</h2>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Upload CSV for bulk screening. Process hundreds of names at once
              with status tracking and downloadable results.
            </p>
          </div>

          {/* Regulation references */}
          <div className="rounded-lg border bg-muted/40 p-5">
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              Regulatory References
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Reg.&nbsp;11 (TFS / Targeted Financial Sanctions) &middot;
              Reg.&nbsp;10.1(b) (EDD for PEPs) &middot; Reg.&nbsp;12.1
              (Ongoing Monitoring) &middot; PVARA NOC Regulations 2025 &middot;
              Virtual Assets Act 2026
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
