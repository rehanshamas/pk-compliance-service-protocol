import Link from "next/link";

const FAQ_ITEMS = [
  {
    q: "What is CIP?",
    a: "CIP (Compliance Infrastructure Platform) is a B2B RegTech service that helps VASPs (Virtual Asset Service Providers) in Pakistan meet their AML/CFT obligations. We provide KYC, sanctions screening, blockchain analytics, and regulatory reporting — all in one platform.",
  },
  {
    q: "Who needs to use CIP?",
    a: "VASPs in Pakistan — exchanges, custodians, and other entities that offer virtual asset services — need to comply with the Virtual Assets Act 2026 and PVARA regulations. CIP helps them do that efficiently.",
  },
  {
    q: "Do I need a PVARA NOC or license to apply?",
    a: "You can apply while your NOC or license is pending. We review applications from entities at different stages: NOC applied, NOC granted, license applied, or licensed. We will work with you based on your regulatory status.",
  },
  {
    q: "How long does the application process take?",
    a: "We review each VASP application and respond within 2–3 business days. Once approved, you receive login credentials and can start using the platform.",
  },
  {
    q: "What is an MLRO and why do I need one?",
    a: "MLRO (Money Laundering Reporting Officer) is a designated officer responsible for receiving internal reports of suspicious activity and filing STRs to the FMU. Every VASP must have one. CIP requires the MLRO&apos;s contact details during onboarding.",
  },
  {
    q: "What is KYC and why is it required?",
    a: "KYC (Know Your Customer) means verifying your customers&apos; identity before offering services. It includes document checks, NADRA verification, and risk assessment. It&apos;s required by law to prevent money laundering and terrorist financing.",
  },
  {
    q: "What is screening and disposition?",
    a: "Screening checks your customers and transactions against sanctions lists (UN, OFAC, EU, NACTA, PEP). When there&apos;s a match, you must &quot;disposition&quot; it — decide if it&apos;s a true hit (real match), false positive (not a match), or escalate for senior review.",
  },
  {
    q: "What are ISAR and STR?",
    a: "ISAR (Internal Suspicious Activity Report) is an internal document you create when you suspect money laundering or terrorist financing. The MLRO reviews it. If approved, it becomes an STR (Suspicious Transaction Report) filed to the FMU via goAML.",
  },
  {
    q: "Is CIP a VASP?",
    a: "No. CIP is an outsourced compliance technology provider. We do not hold customer assets, process transactions, or require a PVARA license. VASPs are our customers.",
  },
];

export default function FaqPage() {
  return (
    <div className="space-y-8">
      <div>
        <Link href="/docs" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to docs
        </Link>
        <h1 className="mt-4 text-3xl font-bold tracking-tight">FAQ</h1>
        <p className="mt-2 text-muted-foreground">
          Answers to common questions about CIP, compliance, and the application process.
        </p>
      </div>

      <div className="space-y-8">
        {FAQ_ITEMS.map((item) => (
          <div key={item.q}>
            <h2 className="font-semibold text-foreground">{item.q}</h2>
            <p className="mt-2 text-muted-foreground">{item.a}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
