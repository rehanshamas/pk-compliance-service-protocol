import Link from "next/link";

export default function DocsPage() {
  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Help & Documentation</h1>
        <p className="mt-2 text-muted-foreground">
          Guides, terminology, and FAQs for VASPs and compliance teams using CIP.
        </p>
      </div>

      {/* Regulatory References */}
      <section className="rounded-lg border bg-card p-6 space-y-4">
        <h2 className="text-xl font-semibold">Regulatory References</h2>
        <p className="text-sm text-muted-foreground">
          CIP is built to comply with the <strong className="text-foreground">PVARA No Objection Certificate Regulations 2025</strong>{" "}
          (Document Code: PVARA/REG/AML-REG/2025-1) issued under the <strong className="text-foreground">Virtual Assets Act 2026</strong>{" "}
          passed by the National Assembly of Pakistan.
        </p>
        <div className="flex flex-wrap gap-4 text-sm">
          <a
            href="https://pvara.gov.pk"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            PVARA Official Website &rarr;
          </a>
          <a
            href="https://www.fmu.gov.pk"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            FMU goAML Portal &rarr;
          </a>
        </div>
        <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
          <p><strong>Key regulations:</strong> Reg. 8 (CDD) &middot; Reg. 9/10 (EDD) &middot; Reg. 11 (TFS/Screening) &middot; Reg. 12 (Monitoring/STRs/CTRs) &middot; Reg. 13 (Recordkeeping) &middot; Reg. 14 (Outsourcing)</p>
          <p><strong>Statutory forms (Annex A):</strong> Form A5 (Outsourcing Register) &middot; Form A6 (Annual Return) &middot; Form A7 (ISAR)</p>
        </div>
      </section>

      {/* PVARA Forms Explained */}
      <section className="rounded-lg border bg-card p-6 space-y-4">
        <h2 className="text-xl font-semibold">PVARA Statutory Forms</h2>
        <p className="text-sm text-muted-foreground">
          The NOC Regulations prescribe several forms under Annex A. CIP automates the generation of the three most operationally relevant forms for VASPs:
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-md border p-4 space-y-2">
            <h3 className="font-semibold text-sm">Form A5</h3>
            <p className="text-xs text-muted-foreground">Outsourcing Declaration &amp; Register. Declares all third-party providers handling AML/CFT functions. Required under Reg. 14.</p>
            <Link href="/docs/form-a5" className="text-xs text-primary hover:underline">Learn more &rarr;</Link>
          </div>
          <div className="rounded-md border p-4 space-y-2">
            <h3 className="font-semibold text-sm">Form A6</h3>
            <p className="text-xs text-muted-foreground">Annual AML/CFT Return. Yearly compliance metrics covering CDD, monitoring, STR/CTR filings, and audit status. Required under Reg. 18.</p>
            <Link href="/docs/form-a6" className="text-xs text-primary hover:underline">Learn more &rarr;</Link>
          </div>
          <div className="rounded-md border p-4 space-y-2">
            <h3 className="font-semibold text-sm">Form A7 (ISAR)</h3>
            <p className="text-xs text-muted-foreground">Internal Suspicious Activity Report. Documents suspicion before MLRO decides whether to file an STR via goAML. Required under Reg. 12.</p>
            <Link href="/docs/isar-str" className="text-xs text-primary hover:underline">Learn more &rarr;</Link>
          </div>
        </div>
      </section>

      <div className="grid gap-6 sm:grid-cols-2">
        <Link
          href="/docs/isar-str"
          className="rounded-lg border bg-card p-6 hover:bg-accent/50 transition-colors"
        >
          <h2 className="font-semibold text-lg">ISAR & STR filing</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            How internal suspicious activity reports become STRs filed to the FMU.
          </p>
        </Link>
        <Link
          href="/docs/form-a5"
          className="rounded-lg border bg-card p-6 hover:bg-accent/50 transition-colors"
        >
          <h2 className="font-semibold text-lg">Form A5 — Outsourcing Register</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Outsourcing declaration and register under NOC Regulation Annex A.
          </p>
        </Link>
        <Link
          href="/docs/form-a6"
          className="rounded-lg border bg-card p-6 hover:bg-accent/50 transition-colors"
        >
          <h2 className="font-semibold text-lg">Form A6 — Annual Return</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Yearly AML/CFT metrics and compliance return under NOC Part 6.
          </p>
        </Link>
        <Link
          href="/docs/record-retention"
          className="rounded-lg border bg-card p-6 hover:bg-accent/50 transition-colors"
        >
          <h2 className="font-semibold text-lg">7-year record retention</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Mandatory retention of AML/CFT records under AMLA and NOC Regulations.
          </p>
        </Link>
        <Link
          href="/docs/goaml-policy"
          className="rounded-lg border bg-card p-6 hover:bg-accent/50 transition-colors"
        >
          <h2 className="font-semibold text-lg">goAML policy</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            What CIP does and does not do regarding goAML STR/CTR filing.
          </p>
        </Link>
        <Link
          href="/docs/contact"
          className="rounded-lg border bg-card p-6 hover:bg-accent/50 transition-colors"
        >
          <h2 className="font-semibold text-lg">Contact us</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Support, application inquiries, and compliance questions.
          </p>
        </Link>
        <Link
          href="/docs/glossary"
          className="rounded-lg border bg-card p-6 hover:bg-accent/50 transition-colors"
        >
          <h2 className="font-semibold text-lg">Glossary</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Definitions of KYC, ISAR, STR, EDD, disposition, and other compliance terms used in CIP.
          </p>
        </Link>
        <Link
          href="/docs/faq"
          className="rounded-lg border bg-card p-6 hover:bg-accent/50 transition-colors"
        >
          <h2 className="font-semibold text-lg">FAQ</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Common questions about CIP, the application process, and compliance requirements.
          </p>
        </Link>
        <Link
          href="/docs/guide"
          className="rounded-lg border bg-card p-6 hover:bg-accent/50 transition-colors sm:col-span-2"
        >
          <h2 className="font-semibold text-lg">How it works</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Application flow, KYC process, screening, ISARs, and regulatory filings — step by step.
          </p>
        </Link>
      </div>
    </div>
  );
}
