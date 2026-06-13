import Link from "next/link";
import { Check, X } from "lucide-react";

export default function GoamlPolicyPage() {
  return (
    <div className="space-y-10">
      <div>
        <Link href="/docs" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to docs
        </Link>
        <h1 className="mt-4 text-3xl font-bold tracking-tight">goAML policy</h1>
        <p className="mt-2 text-muted-foreground">
          What CIP does and does not do regarding the FMU&apos;s goAML portal for STR/CTR filing.
        </p>
      </div>

      <section>
        <h2 className="text-xl font-semibold">Context</h2>
        <p className="mt-2 text-muted-foreground">
          goAML is the FMU&apos;s (Financial Monitoring Unit) online system for filing Suspicious Transaction Reports (STRs) and Currency Transaction Reports (CTRs) in Pakistan. Only registered reporting entities and their authorised users can access and submit via goAML.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Check className="h-5 w-5 text-green-600" />
          What CIP does
        </h2>
        <ul className="mt-4 space-y-2 text-muted-foreground">
          <li><strong className="text-foreground">ISAR workflow</strong> — Create, review, and approve Internal Suspicious Activity Reports before they become STRs.</li>
          <li><strong className="text-foreground">Prepare STR data</strong> — Collect and structure all required fields (subject, suspicion type, narrative, evidence) for filing.</li>
          <li><strong className="text-foreground">Generate goAML-compatible output</strong> — Export XML or data in a format suitable for goAML submission.</li>
          <li><strong className="text-foreground">Link evidence</strong> — Attach screening results, analytics, and documents to support the report.</li>
          <li><strong className="text-foreground">Audit trail</strong> — Record who created, reviewed, and approved each ISAR.</li>
          <li><strong className="text-foreground">CTR preparation</strong> — Help aggregate and format CTR data for threshold-based reporting.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <X className="h-5 w-5 text-red-600" />
          What CIP does not do
        </h2>
        <ul className="mt-4 space-y-2 text-muted-foreground">
          <li><strong className="text-foreground">File STRs or CTRs on your behalf</strong> — Submission to goAML is done by you or your MLRO.</li>
          <li><strong className="text-foreground">Access goAML</strong> — CIP does not log into the FMU&apos;s goAML portal.</li>
          <li><strong className="text-foreground">Submit reports to the FMU</strong> — You must submit the generated file/data through your own goAML account.</li>
          <li><strong className="text-foreground">Manage your goAML credentials</strong> — Registration and access to goAML are your responsibility.</li>
          <li><strong className="text-foreground">Guarantee acceptance by FMU</strong> — CIP prepares data; the FMU may request changes. You are responsible for resubmission if needed.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-semibold">Your responsibilities</h2>
        <p className="mt-2 text-muted-foreground">
          As the reporting entity, you remain responsible for: registering with the FMU, obtaining goAML access, reviewing CIP output before submission, and filing STRs/CTRs through goAML within the required timelines.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold">Related</h2>
        <ul className="mt-2 space-y-1">
          <li><Link href="/docs/isar-str" className="text-primary hover:underline">ISAR and STR filing</Link></li>
          <li><Link href="/docs/contact" className="text-primary hover:underline">Contact us</Link></li>
          <li><Link href="/docs/glossary" className="text-primary hover:underline">Glossary</Link></li>
        </ul>
      </section>
    </div>
  );
}
