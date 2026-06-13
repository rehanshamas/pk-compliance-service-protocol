"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-muted/30 px-4">
      <AlertTriangle className="h-16 w-16 text-destructive" />
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-semibold">Something went wrong</h1>
        <p className="text-muted-foreground max-w-sm">
          An unexpected error occurred. You can try again or return to the dashboard.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={reset}>Try again</Button>
        <Link href="/overview">
          <Button variant="outline">Go to dashboard</Button>
        </Link>
        <Link href="/">
          <Button variant="ghost">Home</Button>
        </Link>
      </div>
    </div>
  );
}
