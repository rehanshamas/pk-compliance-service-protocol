import { Loader2 } from "lucide-react";

export default function AuthLoading() {
  return (
    <div className="flex flex-1 items-center justify-center min-h-[300px]">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}
