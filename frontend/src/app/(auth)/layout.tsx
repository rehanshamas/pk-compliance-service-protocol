import { PublicShell } from "@/components/public-shell";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PublicShell>
      <div className="relative flex flex-1 flex-col items-center justify-center px-4 pt-24 pb-12">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_40%,rgba(0,166,81,0.06),transparent_60%)] pointer-events-none" aria-hidden />
        <div className="relative w-full max-w-md">{children}</div>
      </div>
    </PublicShell>
  );
}
