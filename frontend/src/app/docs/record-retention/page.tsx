import Link from "next/link";

export default function RecordRetentionPage() {
  return (
    <div className="space-y-10">
      <div>
        <Link href="/docs" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to docs
        </Link>
        <h1 className="mt-4 text-3xl font-bold tracking-tight">7-year record retention</h1>
        <p className="mt-2 text-muted-foreground">
          Mandatory retention of AML/CFT records under Pakistan&apos;s regulations.
        </p>
      </div>

      <section>
        <h2 className="text-xl font-semibold">What is 7-year record retention?</h2>
        <p className="mt-2 text-muted-foreground">
          Under AMLA 2010 and NOC Regulations, VASPs must keep AML/CFT records for at least 7 years. This includes KYC documents, screening results, ISARs, STRs, transaction records, and correspondence.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold">Why 7 years?</h2>
        <p className="mt-2 text-muted-foreground">
          Regulators and law enforcement need records for investigations and prosecutions. The 7-year period aligns with international standards (e.g., FATF) and gives enough time for audits and enquiries.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold">What records must be retained?</h2>
        <ul className="mt-2 list-disc list-inside space-y-1 text-muted-foreground">
          <li>Customer identification (KYC) and due diligence records</li>
          <li>Transaction records and supporting documents</li>
          <li>ISARs, STRs, and related case files</li>
          <li>Sanctions screening results and dispositions</li>
          <li>Training records and policies</li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-semibold">How does CIP help?</h2>
        <p className="mt-2 text-muted-foreground">
          CIP stores data with an immutable 7-year retention policy. Records are kept in versioned, compliant storage. Deletion is blocked within the retention period. When retention expires, records can be archived or removed per your policy.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold">Related</h2>
        <ul className="mt-2 space-y-1">
          <li><Link href="/docs/isar-str" className="text-primary hover:underline">ISAR and STR filing</Link></li>
          <li><Link href="/docs/glossary" className="text-primary hover:underline">Glossary</Link></li>
          <li><Link href="/docs/guide" className="text-primary hover:underline">How it works</Link></li>
          <li><Link href="/docs/contact" className="text-primary hover:underline">Contact us</Link> — questions about retention or compliance</li>
        </ul>
      </section>
    </div>
  );
}
