"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Users,
  Fingerprint,
  FileSearch,
  ScanFace,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";

export default function KycServicePage() {
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
              <Users className="h-7 w-7 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">
                Identity &amp; KYC
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                NADRA-integrated identity verification, document OCR, liveness
                detection, and risk-based CDD/EDD workflows.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Capabilities */}
      <section className="px-6 pb-16">
        <div className="container max-w-3xl mx-auto space-y-10">
          {/* NADRA */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Fingerprint className="h-5 w-5 text-primary shrink-0" />
              <h2 className="text-lg font-semibold">
                NADRA e-Verisys Integration
              </h2>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Direct integration with Pakistan&apos;s national identity database
              via the Nishan Pakistan API. CNIC demographic verification,
              biometric matching (fingerprint + facial), and Proof-of-Life
              verification — shared across all VASP clients.
            </p>
          </div>

          {/* Document Verification */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <FileSearch className="h-5 w-5 text-primary shrink-0" />
              <h2 className="text-lg font-semibold">Document Verification</h2>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              OCR extraction and authenticity checks for passports, CNICs,
              NICOPs, POCs, utility bills, and bank statements. Automated data
              extraction reduces manual onboarding time.
            </p>
          </div>

          {/* Liveness Detection */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <ScanFace className="h-5 w-5 text-primary shrink-0" />
              <h2 className="text-lg font-semibold">Liveness Detection</h2>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Anti-spoofing facial verification to prevent identity fraud,
              deepfakes, and photo replay attacks during remote onboarding.
            </p>
          </div>

          {/* Risk-Based CDD Tiering */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-primary shrink-0" />
              <h2 className="text-lg font-semibold">
                Risk-Based CDD Tiering
              </h2>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Automated customer risk scoring based on jurisdiction, PEP status,
              source of funds indicators, and transaction profile. Supports the
              VASP&apos;s risk-based approach required by Reg.&nbsp;8.1.
            </p>
          </div>

          {/* EDD Trigger Identification */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-primary shrink-0" />
              <h2 className="text-lg font-semibold">
                EDD Trigger Identification
              </h2>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Automated flagging of customers requiring Enhanced Due Diligence
              under Reg.&nbsp;10.1: high-risk jurisdictions, PEPs, complex
              structures, adverse media hits.
            </p>
          </div>

          {/* Regulation references */}
          <div className="rounded-lg border bg-muted/40 p-5">
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              Regulatory References
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Reg.&nbsp;8 (CDD) &middot; Reg.&nbsp;9/10 (EDD) &middot;
              PVARA NOC Regulations 2025 (PVARA/REG/AML-REG/2025-1) &middot;
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
