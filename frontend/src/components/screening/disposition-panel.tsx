"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { HelpTooltip } from "@/components/compliance/help-tooltip";
import { apiRequest } from "@/lib/api";
import type { ScreeningResult } from "@/lib/types";
import { X, Loader2, AlertTriangle, Snowflake } from "lucide-react";

interface ScreeningDispositionPanelProps {
  result: ScreeningResult | null;
  open: boolean;
  onClose: () => void;
  onDisposition: (disposition: string, rationale: string) => void | Promise<void>;
}

interface MatchDetail {
  watchlist_entry_id: string;
  score: number;
  source?: string;
  matched_fields?: string[];
}

export function ScreeningDispositionPanel({
  result,
  open,
  onClose,
  onDisposition,
}: ScreeningDispositionPanelProps) {
  const router = useRouter();
  const [rationale, setRationale] = useState("");
  const [matches, setMatches] = useState<MatchDetail[] | null>(null);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [showFreezeWarning, setShowFreezeWarning] = useState(false);
  const [disposedAs, setDisposedAs] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setRationale("");
      setShowFreezeWarning(false);
      setDisposedAs(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !result?.id) {
      setMatches(null);
      return;
    }
    setLoadingMatches(true);
    setMatches(null);
    apiRequest<{ matches?: MatchDetail[] }>(`/screening/results/${result.id}`)
      .then((res) => setMatches(res?.matches ?? null))
      .catch(() => setMatches(null))
      .finally(() => setLoadingMatches(false));
  }, [open, result?.id]);

  const isVisible = !!result && open;
  if (!isVisible) return null;

  const sanctionsSources = ["un", "ofac", "eu", "nacta", "opensanctions"];

  const isSanctionsSource = (() => {
    const src = (result?.source ?? "").toString().toLowerCase();
    if (sanctionsSources.includes(src)) return true;
    // Also check individual match sources
    if (matches && matches.length > 0) {
      return matches.some((m) => sanctionsSources.includes((m.source ?? "").toLowerCase()));
    }
    return false;
  })();

  const handleDisposition = async (d: string) => {
    await onDisposition(d, rationale.trim());
    setDisposedAs(d);
    // Show freeze warning if true_positive on a sanctions list (not PEP)
    if (d === "true_positive" && isSanctionsSource) {
      setShowFreezeWarning(true);
    }
  };

  const sourceLabel = (result.source ?? "").toString().toUpperCase() || "—";

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[100] bg-black/80"
        onClick={onClose}
        aria-hidden
      />
      {/* Panel */}
      <div
        className="fixed inset-y-0 right-0 z-[101] flex w-full max-w-lg flex-col border-l bg-background shadow-lg"
        role="dialog"
        aria-labelledby="disposition-title"
        aria-modal="true"
      >
        <div className="flex flex-col gap-1.5 p-6">
          <div className="flex items-center justify-between">
            <h2 id="disposition-title" className="text-lg font-semibold flex items-center gap-2">
              Disposition Match
              <HelpTooltip term="disposition" />
            </h2>
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
              <X className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Review and disposition the screening match
          </p>
        </div>
        {result && (
          <div className="flex-1 overflow-y-auto px-6 pb-6">
            <div className="space-y-6">
              <div>
                <Label className="text-muted-foreground">Screened Entity</Label>
                <p className="font-medium">{result.screenedEntityName}</p>
                <p className="text-sm text-muted-foreground">
                  Match score: {result.matchScore ?? 0}% · Source: {sourceLabel}
                </p>
              </div>
              <div>
                <Label className="text-muted-foreground">Watchlist Match(es)</Label>
                {loadingMatches ? (
                  <p className="text-sm flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading match details…
                  </p>
                ) : matches && matches.length > 0 ? (
                  <ul className="text-sm space-y-2">
                    {matches.map((m, i) => (
                      <li key={m.watchlist_entry_id || i} className="rounded border p-2">
                        <span className="font-mono text-xs">{m.source?.toUpperCase() ?? "—"}</span>
                        <span className="mx-2">·</span>
                        <span>Score: {m.score}%</span>
                        {m.matched_fields && m.matched_fields.length > 0 && (
                          <span className="text-muted-foreground ml-2">
                            (matched: {m.matched_fields.join(", ")})
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No match details available.</p>
                )}
              </div>
              <div>
                <Label htmlFor="rationale">Rationale (required for disposition)</Label>
                <textarea
                  id="rationale"
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  rows={3}
                  placeholder="Document your decision..."
                  value={rationale}
                  onChange={(e) => setRationale(e.target.value)}
                />
              </div>
              {!showFreezeWarning && (
                <div className="flex gap-2 pt-4">
                  <Button variant="destructive" onClick={() => handleDisposition("true_positive")}>
                    True Positive
                  </Button>
                  <Button variant="default" onClick={() => handleDisposition("false_positive")}>
                    False Positive
                  </Button>
                  <Button variant="secondary" onClick={() => handleDisposition("escalated")}>
                    Escalate
                  </Button>
                </div>
              )}

              {/* Sanctions freeze warning after true_positive disposition */}
              {showFreezeWarning && (
                <div className="mt-4 rounded-lg border-2 border-red-600 bg-red-50 p-4 dark:bg-red-950/30">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                    <div className="space-y-2">
                      <p className="font-semibold text-red-700 dark:text-red-400">
                        Confirmed Sanctions Match
                      </p>
                      <p className="text-sm text-red-600 dark:text-red-400">
                        This is a confirmed sanctions match. You are legally required to freeze
                        this customer&apos;s assets immediately under PVARA Reg. 12.2 and report
                        the freeze to FMU.
                      </p>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          // Navigate to customer page — the screenedEntityName may not map directly,
                          // but the user can search for the customer from the KYC page
                          router.push("/kyc/customers");
                        }}
                      >
                        <Snowflake className="mr-2 h-4 w-4" />
                        Go to Customer to Freeze Assets
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>,
    document.body
  );
}
