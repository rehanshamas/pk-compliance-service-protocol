import { PublicShell } from "@/components/public-shell";

export default function ServicesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PublicShell>{children}</PublicShell>;
}
