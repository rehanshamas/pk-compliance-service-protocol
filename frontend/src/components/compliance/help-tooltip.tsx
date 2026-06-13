"use client";

import Link from "next/link";
import { HelpCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getGlossaryEntry, type GlossaryKey } from "@/lib/compliance-glossary";

/** Terms with dedicated Learn more pages */
const LEARN_MORE_PAGES: Partial<Record<GlossaryKey | string, string>> = {
  ISAR: "/docs/isar-str",
  STR: "/docs/isar-str",
  CTR: "/docs/isar-str",
  Form_A5: "/docs/form-a5",
  Form_A6: "/docs/form-a6",
};

interface HelpTooltipProps {
  term: GlossaryKey | string;
  /** Optional: show term as inline text with icon, or icon only */
  showTerm?: boolean;
  className?: string;
}

/**
 * Small info icon that shows compliance term definition on hover.
 * Use next to labels or headings where users may need clarification.
 */
export function HelpTooltip({ term, showTerm = false, className = "" }: HelpTooltipProps) {
  const entry = getGlossaryEntry(term);
  const learnMoreHref = LEARN_MORE_PAGES[term];

  if (!entry) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={`inline-flex items-center gap-1 cursor-help text-muted-foreground hover:text-foreground ${className}`}
        >
          {showTerm && <span className="text-sm font-medium">{entry.term}</span>}
          <HelpCircle className="h-3.5 w-3.5" aria-hidden />
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <p className="font-medium text-foreground">{entry.term}</p>
        <p className="mt-1 text-muted-foreground">{entry.definition}</p>
        {learnMoreHref && (
          <Link href={learnMoreHref} className="mt-2 inline-block text-xs font-medium text-primary hover:underline" target="_blank" rel="noopener noreferrer">
            Learn more →
          </Link>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
