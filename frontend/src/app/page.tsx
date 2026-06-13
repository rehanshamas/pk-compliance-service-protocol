"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getStoredUser } from "@/lib/auth";
import { PublicShell } from "@/components/public-shell";
import { Particles } from "@/components/particles";
import {
  Shield,
  Users,
  Wallet,
  FileText,
  CheckCircle2,
  Zap,
  Globe,
  Lock,
  TrendingDown,
  Clock,
  Layers,
  Banknote,
} from "lucide-react";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    const user = getStoredUser();
    if (user) {
      const isAdmin =
        user.role === "platform_admin" || user.role === "platform_support";
      router.replace(isAdmin ? "/admin/tenants" : "/overview");
      return;
    }
  }, [router]);

  return (
    <PublicShell>
      <Particles />
      {/* Ambient orbs */}
      <div className="ambient">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />
      </div>

      {/* Hero */}
      <section className="relative pt-[128px] pb-[68px] px-6">
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, rgba(128,128,128,0.04) 1px, transparent 0)",
          backgroundSize: "40px 40px",
          maskImage: "radial-gradient(ellipse at center, black 30%, transparent 70%)",
        }} />
        <div className="max-w-[780px] mx-auto text-center relative z-10">
          <h1 className="text-[1.7rem] sm:text-[3.1rem] font-extrabold tracking-[-2px] leading-[1.08] mb-4">
            <span
              className="inline-block bg-clip-text text-transparent leading-[1.08] bg-[length:200%_100%] bg-[linear-gradient(90deg,#0f1f15_0%,#0f1f15_15%,#00a651_35%,#15803d_55%,#00a651_75%,#0f6b30_100%)] dark:bg-[linear-gradient(90deg,#e8edf5_0%,#e8edf5_15%,#00a651_35%,#15803d_55%,#00a651_75%,#01411c_100%)] dark:animate-hero-grad-shift"
            >
              Compliance Infrastructure for VASPs
            </span>
          </h1>
          <p className="text-[1rem] text-muted-foreground max-w-[560px] mx-auto mb-7 leading-[1.65]">
            KYC, sanctions screening, blockchain analytics, and regulatory
            reporting — built for Pakistan under the Virtual Assets Act 2026.
          </p>
          <div className="flex gap-2.5 justify-center flex-wrap">
            <Link href="/apply">
              <button className="relative overflow-hidden px-6 py-[11px] rounded-md bg-primary text-white text-[0.85rem] font-semibold transition-all hover:bg-primary/90 hover:shadow-[0_4px_24px_rgba(59,130,246,0.25)] hover:-translate-y-[1px]">
                Apply for CIP
              </button>
            </Link>
            <Link href="/login">
              <button className="px-6 py-[11px] rounded-md bg-transparent border border-border text-muted-foreground text-[0.85rem] font-semibold transition-all hover:border-muted-foreground/40 hover:text-foreground hover:-translate-y-[1px] inline-flex items-center gap-1.5">
                Sign in →
              </button>
            </Link>
          </div>
          {/* Trust signals — star and bar in Pakistani green */}
          <div className="flex flex-wrap justify-center gap-[18px] mt-10 text-[0.68rem] text-muted-foreground/60">
            <span className="flex items-center gap-1">
              <span className="text-[#00a651] text-[0.5rem]">★</span>
              PVARA NOC aligned
            </span>
            <span className="flex items-center gap-1">
              <span className="w-[3px] h-[3px] rounded-[1px] bg-[#00a651]" />
              NADRA integrated
            </span>
            <span className="flex items-center gap-1">
              <span className="w-[3px] h-[3px] rounded-[1px] bg-[#00a651]" />
              FATF compliant
            </span>
            <span className="flex items-center gap-1">
              <span className="w-[3px] h-[3px] rounded-[1px] bg-[#00a651]" />
              Data hosted in Pakistan
            </span>
          </div>
        </div>
      </section>

      {/* What we do */}
      <section className="relative py-[70px] px-6 bg-card/50">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
        <div className="max-w-[1100px] mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-[1.65rem] font-extrabold tracking-[-0.8px] mb-[5px]">
              What we do
            </h2>
            <p className="text-muted-foreground text-[0.86rem] max-w-[580px] mx-auto leading-[1.6]">
              We provide end-to-end compliance infrastructure for VASPs: from identity verification and sanctions screening
              to blockchain analytics and regulatory reporting. One platform, built for Pakistan&apos;s Virtual Assets Act 2026.
            </p>
          </div>
          <div className="grid gap-[14px] sm:grid-cols-2 lg:grid-cols-4 grid-rows-[auto]">
            {[
              { icon: Users, title: "Identity & KYC", desc: "NADRA verification, document OCR, liveness, face matching, CDD/EDD workflows.", href: "/services/kyc" },
              { icon: Shield, title: "Screening & Watchlist", desc: "UN, OFAC, EU, NACTA, PEP sanctions — fuzzy matching, ongoing monitoring.", href: "/services/screening" },
              { icon: Wallet, title: "Blockchain Analytics", desc: "Wallet risk scoring, mixer detection, Pakistan typologies.", href: "/services/analytics" },
              { icon: FileText, title: "Reports & Filings", desc: "ISAR, STR/CTR, Form A5, Form A6 — regulatory-ready.", href: "/services/reports" },
            ].map((card) => (
              <Link key={card.href} href={card.href} className="h-full">
                <div className="fc card-animated rounded-[24px] border border-border bg-card p-6 h-full min-h-[220px] flex flex-col">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/35 to-primary/15 text-[#00a651] flex items-center justify-center mb-3 shadow-[0_0_20px_rgba(0,166,81,0.15)]">
                    <card.icon className="h-[18px] w-[18px]" />
                  </div>
                  <h3 className="text-[0.88rem] font-bold mb-1">{card.title}</h3>
                  <p className="text-[0.73rem] text-muted-foreground leading-[1.55] flex-1">{card.desc}</p>
                  <span className="text-[0.68rem] text-primary mt-2 block">Learn more →</span>
                  <div className="absolute bottom-3 right-3 flex gap-1 opacity-40">
                    <span className="w-2 h-2 rounded-sm bg-[#15803d] translate-y-1" />
                    <span className="w-2 h-2 rounded-sm bg-[#00a651]" />
                    <span className="w-2 h-2 rounded-sm bg-[#01411c] translate-x-2 -translate-y-1" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Financial benefits */}
      <section className="py-[70px] px-6">
        <div className="max-w-[1100px] mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-[1.65rem] font-extrabold tracking-[-0.8px] mb-[5px]">
              Financial benefits
            </h2>
            <p className="text-muted-foreground text-[0.86rem] max-w-[580px] mx-auto leading-[1.6]">
              Lower compliance spend, faster launch, and predictable costs — so you can focus on building your business.
            </p>
          </div>
          <div className="grid gap-[14px] sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: TrendingDown, title: "Lower total cost", desc: "One platform instead of multiple vendors. Shared infrastructure means you avoid duplicate subscriptions and integration overhead." },
              { icon: Clock, title: "Faster time to market", desc: "Go live in weeks, not months. Pre-built NADRA, screening, and reporting — no custom build for core compliance." },
              { icon: Layers, title: "Less manual work", desc: "Automated KYC, screening, and report generation. Scale without scaling your compliance team linearly." },
              { icon: Banknote, title: "Predictable spend", desc: "Transparent pricing and usage-based models. No surprise audit prep costs or last-minute vendor fees." },
            ].map((card) => (
              <div key={card.title} className="bc card-animated rounded-[24px] border border-border bg-card p-6 min-h-[220px] flex flex-col">
                <div className="text-[1.2rem] mb-[9px] flex items-center gap-1.5">
                  <card.icon className="h-5 w-5" />
                  <span className="text-[0.52rem] font-bold px-2 py-0.5 rounded-md bg-primary/10 text-primary uppercase">Save</span>
                </div>
                <h3 className="text-[0.86rem] font-bold mb-1">{card.title}</h3>
                <p className="text-[0.72rem] text-muted-foreground leading-[1.55] flex-1">{card.desc}</p>
                <div className="absolute bottom-3 right-3 flex gap-1 opacity-35">
                  <span className="w-1.5 h-1.5 rounded-[1px] bg-[#15803d]" />
                  <span className="w-1.5 h-1.5 rounded-[1px] bg-[#00a651]" />
                  <span className="w-1.5 h-1.5 rounded-[1px] bg-[#01411c]" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why choose CIP */}
      <section className="relative py-[70px] px-6 bg-card/50">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
        <div className="max-w-[1100px] mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-[1.65rem] font-extrabold tracking-[-0.8px] mb-[5px]">Why choose CIP</h2>
            <p className="text-muted-foreground text-[0.86rem] max-w-[580px] mx-auto leading-[1.6]">
              Built for Pakistani regulation. Not an adapted international product — designed from the ground up for PVARA NOC, AMLA, and the Virtual Assets Act.
            </p>
          </div>
          <div className="grid gap-[14px] sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: Globe, title: "Pakistan-first", desc: "NADRA-integrated KYC, goAML-ready exports, Form A5/A6 support. Regulatory frameworks built in, not bolted on." },
              { icon: Zap, title: "Full stack", desc: "Identity, screening, analytics, and reporting in one place. No stitching together multiple vendors or APIs." },
              { icon: Lock, title: "Audit-ready", desc: "7-year immutable retention, full audit trails, role-based access. Built for regulatory scrutiny." },
              { icon: CheckCircle2, title: "FATF-aligned", desc: "CDD/EDD, STR workflow, sanctions screening — aligned with international AML/CFT standards." },
            ].map((card) => (
              <div key={card.title} className="bc card-animated rounded-[24px] border border-border bg-card p-6 min-h-[220px] flex flex-col">
                <card.icon className="h-5 w-5 text-primary mb-[9px]" />
                <h3 className="text-[0.86rem] font-bold mb-1">{card.title}</h3>
                <p className="text-[0.72rem] text-muted-foreground leading-[1.55] flex-1">{card.desc}</p>
                <div className="absolute bottom-3 right-3 flex gap-1 opacity-35">
                  <span className="w-1.5 h-1.5 rounded-[1px] bg-[#15803d]" />
                  <span className="w-1.5 h-1.5 rounded-[1px] bg-[#00a651]" />
                  <span className="w-1.5 h-1.5 rounded-[1px] bg-[#01411c]" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How CIP works */}
      <section className="py-[70px] px-6 relative bg-background">
        <div className="max-w-[720px] mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
            <h2 className="text-[1.65rem] font-extrabold tracking-[-0.8px]">
              How CIP works
            </h2>
            <p className="text-muted-foreground text-[0.86rem] leading-[1.6]">
              From onboarding to ongoing compliance — a streamlined process built for Pakistan&apos;s regulatory landscape.
            </p>
          </div>
          <div className="relative">
            <div className="absolute left-1/2 top-0 bottom-0 w-0.5 -translate-x-1/2 bg-gradient-to-b from-[#00a651] to-[#15803d] rounded" />
            {[
              { side: "left", title: "Apply & onboard", desc: "Submit your VASP details. We review within 2–3 business days and provision your tenant with KYC, screening, and reporting access." },
              { side: "right", title: "Integrate & configure", desc: "Connect via API or dashboard. Configure NADRA, screening lists, and goAML export settings. Your MLRO gets full access." },
              { side: "left", title: "Operate & monitor", desc: "Run KYC, screen customers, check wallets. ISAR workflow routes to your MLRO. Automated re-screening keeps you current." },
              { side: "right", title: "Report & comply", desc: "Generate Form A5, A6, STR/CTR packages. Export for goAML. 7-year retention, audit trails, and PVARA-ready documentation." },
            ].map((step, i) => (
              <div key={i} className={`relative flex items-center gap-4 mb-8 last:mb-0 ${step.side === "left" ? "flex-row" : "flex-row-reverse"}`}>
                <div className={`flex-1 ${step.side === "left" ? "text-right" : "text-left"}`}>
                  <div className="timeline-card card-animated inline-block p-5 rounded-xl border border-border bg-card text-left w-full">
                    <h3 className="text-[0.92rem] font-bold mb-1.5">{step.title}</h3>
                    <p className="text-[0.78rem] text-muted-foreground leading-[1.6]">{step.desc}</p>
                  </div>
                </div>
                <div className="w-3 h-3 rounded-full bg-[#00a651] shadow-[0_0_12px_rgba(0,166,81,0.4)] flex-shrink-0 z-10" />
                <div className="flex-1" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Regulatory Compliance */}
      <section className="py-[70px] px-6">
        <div className="max-w-[1100px] mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-[1.65rem] font-extrabold tracking-[-0.8px] mb-[5px]">Regulatory compliance</h2>
            <p className="text-muted-foreground text-[0.86rem] max-w-[580px] mx-auto leading-[1.6]">
              Built for the <strong className="text-foreground">PVARA No Objection Certificate Regulations 2025</strong>{" "}
              (PVARA/REG/AML-REG/2025-1) under Pakistan&apos;s Virtual Assets Act 2026.
            </p>
          </div>
          <div className="grid gap-[14px] sm:grid-cols-2 lg:grid-cols-3">
            <div className="rc card-animated rounded-[16px] border border-border bg-card p-6 min-h-[220px] flex flex-col">
              <h3 className="text-[0.9rem] font-bold mb-1">PVARA</h3>
              <p className="text-[0.72rem] text-muted-foreground leading-[1.55] mb-[5px] flex-1">
                Pakistan Virtual Asset Regulatory Authority — the primary regulator for VASPs.
              </p>
              <a href="https://pvara.gov.pk" target="_blank" rel="noopener noreferrer" className="text-[0.7rem] text-primary">pvara.gov.pk</a>
            </div>
            <div className="rc card-animated rounded-[16px] border border-border bg-card p-6 min-h-[220px] flex flex-col">
              <h3 className="text-[0.9rem] font-bold mb-1">FMU goAML</h3>
              <p className="text-[0.72rem] text-muted-foreground leading-[1.55] mb-[5px] flex-1">
                Financial Monitoring Unit portal for STR/CTR filing.
              </p>
              <a href="https://www.fmu.gov.pk" target="_blank" rel="noopener noreferrer" className="text-[0.7rem] text-primary">fmu.gov.pk</a>
            </div>
            <div className="rc card-animated rounded-[16px] border border-border bg-card p-6 min-h-[220px] flex flex-col">
              <h3 className="text-[0.9rem] font-bold mb-1">Statutory Forms (Annex A)</h3>
              <p className="text-[0.72rem] text-muted-foreground leading-[1.55] mb-[5px] flex-1">
                Learn about the PVARA regulatory forms that CIP automates for your VASP.
              </p>
              <div className="flex flex-col gap-[6px] text-[0.7rem]">
                <Link href="/docs/form-a5" className="text-primary hover:underline">Form A5 — Outsourcing Declaration &amp; Register</Link>
                <Link href="/docs/form-a6" className="text-primary hover:underline">Form A6 — Annual AML/CFT Return</Link>
                <Link href="/docs/isar-str" className="text-primary hover:underline">Form A7 — ISAR &amp; STR Filing</Link>
              </div>
            </div>
          </div>
          <div className="mt-4 text-center text-[0.63rem] text-muted-foreground/60 leading-[1.7]">
            Key regulations: Reg. 8 (CDD) · Reg. 9/10 (EDD) · Reg. 11 (TFS/Screening) · Reg. 12 (Monitoring/STRs) · Reg. 13 (Recordkeeping) · Reg. 14 (Outsourcing) · Reg. 18 (Annual Return)
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative py-[70px] px-6">
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[500px] h-[250px] bg-[radial-gradient(ellipse,rgba(0,166,81,0.06)_0%,transparent_70%)] pointer-events-none" />
        <div className="cta-card max-w-[560px] mx-auto p-10 rounded-[20px] border border-border bg-card text-center relative z-10 transition-all hover:border-[#00a651] hover:shadow-[0_0_0_1px_rgba(0,166,81,0.15)]">
          <h2 className="text-[1.4rem] font-extrabold tracking-[-0.5px] mb-2">
            Ready to streamline your compliance?
          </h2>
          <p className="text-muted-foreground text-[0.88rem] mb-5">
            We review each VASP application within 2–3 business days.
          </p>
          <Link href="/apply">
            <button className="px-6 py-[11px] rounded-md bg-primary text-white text-[0.85rem] font-semibold transition-all hover:bg-primary/90 hover:shadow-[0_4px_24px_rgba(59,130,246,0.25)] hover:-translate-y-[1px]">
              Apply for CIP →
            </button>
          </Link>
        </div>
      </section>
    </PublicShell>
  );
}
