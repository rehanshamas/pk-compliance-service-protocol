import { PublicShell } from "@/components/public-shell";
import { Loader2 } from "lucide-react";

export default function ApplyLoading() {
  return (
    <PublicShell>
      <div className="container max-w-2xl mx-auto py-16 pt-24 px-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    </PublicShell>
  );
}
