import Link from "next/link";

export default function GuidePage() {
  return (
    <div className="space-y-12">
      <div>
        <Link href="/docs" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to docs
        </Link>
        <h1 className="mt-4 text-3xl font-bold tracking-tight">How CIP works</h1>
        <p className="mt-2 text-muted-foreground">
          Step-by-step guides to application, KYC, screening, and regulatory reporting.
        </p>
      </div>

      <section>
        <h2 className="text-xl font-semibold">Applying for CIP</h2>
        <ol className="mt-4 list-decimal list-inside space-y-3 text-muted-foreground">
          <li>Fill out the application form with company details, contacts (MLRO, compliance, admin), and regulatory status.</li>
          <li>We review your application within 2–3 business days.</li>
          <li>If approved, we create your tenant account and send login credentials to your MLRO.</li>
          <li>You can then access the dashboard, configure screening and API keys, and start onboarding customers.</li>
        </ol>
        <Link href="/apply" className="mt-4 inline-block text-sm font-medium text-primary hover:underline">
          Apply for CIP →
        </Link>
      </section>

      <section>
        <h2 className="text-xl font-semibold">KYC process</h2>
        <p className="mt-2 text-muted-foreground">
          When you add a customer, CIP runs them through a verification pipeline:
        </p>
        <ol className="mt-4 list-decimal list-inside space-y-3 text-muted-foreground">
          <li><strong>Document upload</strong> — Customer uploads ID and selfie.</li>
          <li><strong>OCR</strong> — We extract name, DOB, CNIC from the ID image.</li>
          <li><strong>Face matching</strong> — Selfie is compared to the ID photo.</li>
          <li><strong>Liveness</strong> — We verify the person is real and present.</li>
          <li><strong>NADRA verification</strong> — CNIC is checked against the national database.</li>
          <li><strong>Risk scoring</strong> — We assign a risk tier (low/medium/high). High risk triggers EDD.</li>
          <li><strong>Approval or rejection</strong> — The customer is either approved for services or rejected.</li>
        </ol>
      </section>

      <section>
        <h2 className="text-xl font-semibold">Screening & disposition</h2>
        <p className="mt-2 text-muted-foreground">
          You screen customers and transactions against UN, OFAC, EU, NACTA, and PEP watchlists. When there&apos;s a match:
        </p>
        <ol className="mt-4 list-decimal list-inside space-y-3 text-muted-foreground">
          <li>Review the match details (screened entity vs watchlist entry).</li>
          <li>Document your rationale.</li>
          <li>Choose: <strong>True Positive</strong> (confirmed hit), <strong>False Positive</strong> (no match), or <strong>Escalate</strong> (needs senior review).</li>
          <li>True positives may require enhanced monitoring or filing an ISAR/STR.</li>
        </ol>
      </section>

      <section>
        <h2 className="text-xl font-semibold">ISAR & STR workflow</h2>
        <p className="mt-2 text-muted-foreground">
          When you identify suspicious activity:
        </p>
        <ol className="mt-4 list-decimal list-inside space-y-3 text-muted-foreground">
          <li>Create an <strong>ISAR</strong> (Internal Suspicious Activity Report) with subject, suspicion type, and narrative.</li>
          <li>Link supporting evidence (screening results, analytics, documents).</li>
          <li>Submit for MLRO review.</li>
          <li>The MLRO approves or rejects. If approved, the ISAR is ready to file as an STR.</li>
          <li>STR is filed via goAML (FMU&apos;s portal).</li>
        </ol>
      </section>

      <section>
        <h2 className="text-xl font-semibold">Regulatory context</h2>
        <p className="mt-2 text-muted-foreground">
          CIP is built for Pakistan&apos;s Virtual Assets Act 2026 and PVARA NOC Regulations 2025. Key obligations we help you meet:
        </p>
        <ul className="mt-4 list-disc list-inside space-y-2 text-muted-foreground">
          <li>CDD/EDD (Customer / Enhanced Due Diligence)</li>
          <li>Sanctions screening (TFS, Reg. 11)</li>
          <li>Transaction monitoring</li>
          <li><Link href="/docs/isar-str" className="text-primary hover:underline">ISAR and STR filing</Link></li>
          <li><Link href="/docs/form-a5" className="text-primary hover:underline">Form A5</Link> (outsourcing register), <Link href="/docs/form-a6" className="text-primary hover:underline">Form A6</Link> (annual return)</li>
          <li><Link href="/docs/record-retention" className="text-primary hover:underline">7-year record retention</Link></li>
        </ul>
      </section>
    </div>
  );
}
