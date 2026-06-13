import Link from "next/link";
import { Mail } from "lucide-react";

export default function ContactPage() {
  return (
    <div className="space-y-10">
      <div>
        <Link href="/docs" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to docs
        </Link>
        <h1 className="mt-4 text-3xl font-bold tracking-tight">Contact us</h1>
        <p className="mt-2 text-muted-foreground">
          Get in touch with the CIP team for support, applications, and general inquiries.
        </p>
      </div>

      <section className="space-y-6">
        <div className="rounded-lg border p-6">
          <h2 className="font-semibold flex items-center gap-2">
            <Mail className="h-4 w-4" />
            General support
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Questions about CIP, technical support, or account issues.
          </p>
          <a href="mailto:support@cip.pk" className="mt-2 inline-block text-primary hover:underline font-medium">
            support@cip.pk
          </a>
        </div>

        <div className="rounded-lg border p-6">
          <h2 className="font-semibold flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Application inquiries
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Questions about applying for CIP, onboarding, or partnership.
          </p>
          <a href="mailto:apply@cip.pk" className="mt-2 inline-block text-primary hover:underline font-medium">
            apply@cip.pk
          </a>
        </div>

        <div className="rounded-lg border p-6">
          <h2 className="font-semibold flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Compliance & goAML
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Questions about STR filing, goAML integration, or regulatory reporting.
          </p>
          <a href="mailto:compliance@cip.pk" className="mt-2 inline-block text-primary hover:underline font-medium">
            compliance@cip.pk
          </a>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold">Response time</h2>
        <p className="mt-2 text-muted-foreground">
          We aim to respond within 1–2 business days. For urgent compliance matters, include &quot;Urgent&quot; in the subject line.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold">Related</h2>
        <ul className="mt-2 space-y-1">
          <li><Link href="/apply" className="text-primary hover:underline">Apply for CIP</Link></li>
          <li><Link href="/docs/goaml-policy" className="text-primary hover:underline">goAML policy</Link></li>
          <li><Link href="/docs/faq" className="text-primary hover:underline">FAQ</Link></li>
        </ul>
      </section>
    </div>
  );
}
