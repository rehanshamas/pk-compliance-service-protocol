import Link from "next/link";
import { COMPLIANCE_GLOSSARY } from "@/lib/compliance-glossary";

export default function GlossaryPage() {
  const entries = Object.values(COMPLIANCE_GLOSSARY);

  return (
    <div className="space-y-8">
      <div>
        <Link href="/docs" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to docs
        </Link>
        <h1 className="mt-4 text-3xl font-bold tracking-tight">Glossary</h1>
        <p className="mt-2 text-muted-foreground">
          Compliance and regulatory terms used in CIP and under Pakistan&apos;s Virtual Assets Act 2026.
        </p>
      </div>

      <div className="space-y-6">
        {entries.map((entry) => (
          <div key={entry.term} className="border-b pb-6 last:border-0">
            <h3 className="font-semibold text-foreground">{entry.term}</h3>
            <p className="mt-1 text-muted-foreground">{entry.definition}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
