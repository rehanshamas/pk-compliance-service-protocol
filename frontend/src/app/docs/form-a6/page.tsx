import Link from "next/link";

export default function FormA6DocPage() {
  return (
    <div className="space-y-10">
      <div>
        <Link href="/docs" className="text-sm text-muted-foreground hover:text-foreground">
          &larr; Back to docs
        </Link>
        <h1 className="mt-4 text-3xl font-bold tracking-tight">Form A6 — Annual AML/CFT Return</h1>
        <p className="mt-2 text-muted-foreground">
          Yearly reporting of compliance metrics to PVARA.
        </p>
      </div>

      {/* PVARA Reference */}
      <section className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-2">
        <h2 className="text-sm font-semibold text-primary">PVARA Regulatory Reference</h2>
        <p className="text-sm text-muted-foreground">
          <strong className="text-foreground">Regulation 18 (Ongoing Obligations), Annex A</strong> of the{" "}
          <a href="https://pvara.gov.pk" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
            PVARA No Objection Certificate Regulations 2025
          </a>{" "}
          (Document Code: PVARA/REG/AML-REG/2025-1).
        </p>
        <p className="text-xs text-muted-foreground">
          Form A6 covers 8 sections: (1) Entity Profile, (2) Governance, (3) Risk Assessment Update,
          (4) CDD Metrics, (5) Transaction Monitoring Metrics, (6) STR/CTR Reporting,
          (7) Independent Audit &amp; Remediation, (8) MLRO &amp; CEO Declaration.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold">What is Form A6?</h2>
        <p className="mt-2 text-muted-foreground">
          Form A6 is the Annual AML/CFT Return prescribed under Regulation 18, Annex A of the PVARA NOC Regulations 2025. You submit it yearly with aggregated statistics: customers onboarded, screenings conducted, STRs filed, training hours, and other compliance metrics.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold">Why do I need it?</h2>
        <p className="mt-2 text-muted-foreground">
          The regulator requires an annual snapshot of your compliance program. Form A6 helps them assess risk and allocate resources. Missing the deadline can lead to penalties.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold">When is it due?</h2>
        <p className="mt-2 text-muted-foreground">
          Typically within a set period after the end of the financial year (e.g., by 31 March for the prior year). Check your NOC and regulator guidance for the exact deadline.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold">How to use it in CIP</h2>
        <p className="mt-2 text-muted-foreground">
          CIP aggregates your compliance data. Go to Reports → Form A6, select the reporting year, and generate the return. The Overview page shows your next regulatory deadline.
        </p>
        <Link href="/reports/form-a6" className="mt-4 inline-block text-sm font-medium text-primary hover:underline">
          Go to Form A6 →
        </Link>
      </section>

      <section>
        <h2 className="text-xl font-semibold">Related</h2>
        <ul className="mt-2 space-y-1">
          <li><Link href="/docs/form-a5" className="text-primary hover:underline">Form A5 — Outsourcing Register</Link></li>
          <li><Link href="/docs/glossary" className="text-primary hover:underline">Glossary</Link></li>
          <li><Link href="/docs/guide" className="text-primary hover:underline">How it works</Link></li>
        </ul>
      </section>
    </div>
  );
}
