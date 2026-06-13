import Link from "next/link";

export default function IsarStrPage() {
  return (
    <div className="space-y-10">
      <div>
        <Link href="/docs" className="text-sm text-muted-foreground hover:text-foreground">
          &larr; Back to docs
        </Link>
        <h1 className="mt-4 text-3xl font-bold tracking-tight">ISAR and STR Filing</h1>
        <p className="mt-2 text-muted-foreground">
          Internal Suspicious Activity Reports (ISARs) and Suspicious Transaction Reports (STRs) — how they work and how to file.
        </p>
      </div>

      {/* PVARA Reference */}
      <section className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-2">
        <h2 className="text-sm font-semibold text-primary">PVARA Regulatory Reference</h2>
        <p className="text-sm text-muted-foreground">
          <strong className="text-foreground">Form A7 — Internal Suspicious Activity Report (ISAR)</strong>, Annex A of the{" "}
          <a href="https://pvara.gov.pk" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
            PVARA No Objection Certificate Regulations 2025
          </a>{" "}
          (Document Code: PVARA/REG/AML-REG/2025-1). See also Reg. 12 (Transaction Monitoring &amp; STRs).
        </p>
        <p className="text-xs text-muted-foreground">
          Form A7 has 5 sections: (1) Reporter Details, (2) Customer Details, (3) Transaction Details,
          (4) Suspicion Narrative, (5) MLRO Determination (file STR / do not file / additional info required).
          VASPs may use their own ISAR format but must include these fields at minimum.
          STRs/CTRs are filed to the{" "}
          <a href="https://www.fmu.gov.pk" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
            FMU via the goAML portal
          </a>.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold">What are ISAR and STR?</h2>
        <div className="mt-4 space-y-4 text-muted-foreground">
          <p>
            <strong className="text-foreground">ISAR</strong> (Internal Suspicious Activity Report) is an internal document you create when you suspect money laundering or terrorist financing. It stays inside your organization until your MLRO decides whether to file it.
          </p>
          <p>
            <strong className="text-foreground">STR</strong> (Suspicious Transaction Report) is the formal report you file to the FMU (Financial Monitoring Unit) when your MLRO approves an ISAR. Filing is mandatory under Pakistan&apos;s Anti-Money Laundering Act and Virtual Assets Act.
          </p>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold">Why do I need both?</h2>
        <p className="mt-2 text-muted-foreground">
          The ISAR lets you capture and document suspicion internally before deciding to report. The MLRO reviews it, adds context if needed, and then approves or rejects. Only approved ISARs become STRs. This two-step process ensures proper governance and avoids premature or incomplete filings.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold">How to file an ISAR and STR in CIP</h2>
        <ol className="mt-4 list-decimal list-inside space-y-3 text-muted-foreground">
          <li>Create an ISAR with subject name, suspicion type, and narrative. Link supporting evidence (screening results, analytics, documents).</li>
          <li>Submit for MLRO review.</li>
          <li>The MLRO approves or rejects. If approved, the ISAR is ready to file as an STR.</li>
          <li>File the STR via goAML (FMU&apos;s portal). CIP can generate the XML or export data for goAML submission.</li>
        </ol>
        <Link href="/reports/isars" className="mt-4 inline-block text-sm font-medium text-primary hover:underline">
          Go to ISARs →
        </Link>
      </section>

      <section>
        <h2 className="text-xl font-semibold">Related</h2>
        <ul className="mt-2 space-y-1">
          <li><Link href="/docs/goaml-policy" className="text-primary hover:underline">goAML policy</Link></li>
          <li><Link href="/docs/glossary" className="text-primary hover:underline">Glossary: ISAR, STR, MLRO</Link></li>
          <li><Link href="/docs/faq" className="text-primary hover:underline">FAQ</Link></li>
          <li><Link href="/docs/contact" className="text-primary hover:underline">Contact</Link></li>
          <li><Link href="/docs/guide" className="text-primary hover:underline">How it works</Link></li>
        </ul>
      </section>
    </div>
  );
}
