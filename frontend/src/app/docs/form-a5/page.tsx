import Link from "next/link";

export default function FormA5Page() {
  return (
    <div className="space-y-10">
      <div>
        <Link href="/docs" className="text-sm text-muted-foreground hover:text-foreground">
          &larr; Back to docs
        </Link>
        <h1 className="mt-4 text-3xl font-bold tracking-tight">Form A5 — Outsourcing Declaration &amp; Register</h1>
        <p className="mt-2 text-muted-foreground">
          How to declare and maintain your outsourcing arrangements for AML/CFT compliance.
        </p>
      </div>

      {/* PVARA Reference */}
      <section className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-2">
        <h2 className="text-sm font-semibold text-primary">PVARA Regulatory Reference</h2>
        <p className="text-sm text-muted-foreground">
          <strong className="text-foreground">Regulation 14 (Outsourcing), Annex A</strong> of the{" "}
          <a href="https://pvara.gov.pk" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
            PVARA No Objection Certificate Regulations 2025
          </a>{" "}
          (Document Code: PVARA/REG/AML-REG/2025-1).
        </p>
        <p className="text-xs text-muted-foreground">
          Form A5 requires 11 fields per outsourcing arrangement: provider name, country, function outsourced, AML/CFT relevance,
          data shared, SLA summary, audit rights, sub-outsourcing status, termination rights, risk assessment, and monitoring frequency.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold">What is Form A5?</h2>
        <p className="mt-2 text-muted-foreground">
          Form A5 is the Outsourcing Declaration &amp; Register prescribed under Regulation 14, Annex A of the PVARA NOC Regulations 2025. It lists all outsourced compliance functions (e.g., KYC verification, sanctions screening, analytics) with their providers, scope, and status.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold">Why do I need it?</h2>
        <p className="mt-2 text-muted-foreground">
          Regulators must know what compliance activities you outsource and to whom. Outsourcing does not relieve you of responsibility — you remain liable for compliance. Form A5 keeps an auditable record of arrangements like CIP (shared RegTech platform per NOC Reg. 14).
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold">How to use it in CIP</h2>
        <p className="mt-2 text-muted-foreground">
          CIP tracks your outsourcing arrangements. Go to Reports → Form A5 to view the current register and generate a downloadable Form A5 for regulatory submission.
        </p>
        <Link href="/reports/form-a5" className="mt-4 inline-block text-sm font-medium text-primary hover:underline">
          Go to Form A5 →
        </Link>
      </section>

      <section>
        <h2 className="text-xl font-semibold">Related</h2>
        <ul className="mt-2 space-y-1">
          <li><Link href="/docs/form-a6" className="text-primary hover:underline">Form A6 — Annual Return</Link></li>
          <li><Link href="/docs/glossary" className="text-primary hover:underline">Glossary</Link></li>
          <li><Link href="/docs/guide" className="text-primary hover:underline">How it works</Link></li>
        </ul>
      </section>
    </div>
  );
}
