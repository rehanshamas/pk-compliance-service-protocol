"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Wallet,
  Eye,
  Database,
  Gem,
  MapPin,
  CheckCircle2,
} from "lucide-react";

export default function AnalyticsServicePage() {
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
              <Wallet className="h-7 w-7 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">
                Blockchain Analytics
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Three-layer wallet risk scoring from on-chain data — zero to
                commercial grade.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Capabilities */}
      <section className="px-6 pb-16">
        <div className="container max-w-3xl mx-auto space-y-10">
          {/* Layer 1 */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Eye className="h-5 w-5 text-primary shrink-0" />
              <h2 className="text-lg font-semibold">
                Layer 1 — Blockscout (Free)
              </h2>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Real-time on-chain lookups via open-source blockchain explorer.
              Address data, transaction history, token transfers, contract
              inspection across EVM chains.
            </p>
          </div>

          {/* Layer 2 */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Database className="h-5 w-5 text-primary shrink-0" />
              <h2 className="text-lg font-semibold">
                Layer 2 — Subsquid (Included)
              </h2>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Deep historical indexing with graph traversal (5+ hops), mixer
              detection, cross-chain bridge monitoring, and cross-client
              anonymized intelligence.
            </p>
          </div>

          {/* Layer 3 */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Gem className="h-5 w-5 text-primary shrink-0" />
              <h2 className="text-lg font-semibold">
                Layer 3 — Commercial (Premium)
              </h2>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Pay-as-you-go commercial API for edge cases. Proprietary
              clustering, attribution data, and deep investigation reports.
              Billed per query.
            </p>
          </div>

          {/* Pakistan-Specific Typologies */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <MapPin className="h-5 w-5 text-primary shrink-0" />
              <h2 className="text-lg font-semibold">
                Pakistan-Specific Typologies
              </h2>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Custom detection for hawala/hundi flow patterns, PKR 2M CTR
              threshold structuring, trade-based money laundering indicators from
              FMU strategic analyses.
            </p>
          </div>

          {/* Regulation references */}
          <div className="rounded-lg border bg-muted/40 p-5">
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              Regulatory References
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Reg.&nbsp;12 (Transaction Monitoring) &middot; PVARA NOC
              Regulations 2025 &middot; FMU Strategic Analysis typologies
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
