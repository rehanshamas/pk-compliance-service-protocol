import { PublicShell } from "@/components/public-shell";

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PublicShell>
      <div className="container max-w-3xl mx-auto px-6 pt-24 pb-12 flex-1">
        {children}
      </div>
    </PublicShell>
  );
}
