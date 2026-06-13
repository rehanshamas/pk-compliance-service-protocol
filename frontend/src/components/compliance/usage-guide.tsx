"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";

interface UsageGuideProps {
  title: string;
  steps: string[];
  defaultOpen?: boolean;
  className?: string;
}

/**
 * Collapsible usage guide for key flows.
 * Helps new users understand multi-step processes like ISAR creation or disposition.
 */
export function UsageGuide({
  title,
  steps,
  defaultOpen = false,
  className,
}: UsageGuideProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div
      className={cn(
        "rounded-lg border bg-muted/30 text-sm",
        className
      )}
    >
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left font-medium hover:bg-muted/50 transition-colors"
      >
        <Lightbulb className="h-4 w-4 text-amber-500 shrink-0" />
        <span>{title}</span>
        {open ? (
          <ChevronDown className="h-4 w-4 ml-auto shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 ml-auto shrink-0 text-muted-foreground" />
        )}
      </button>
      {open && (
        <ol className="list-decimal list-inside space-y-2 px-4 pb-4 text-muted-foreground">
          {steps.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>
      )}
    </div>
  );
}
