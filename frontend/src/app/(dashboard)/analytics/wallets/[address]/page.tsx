"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api";
import { ArrowLeft, RefreshCw, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

interface WalletDetail {
  id: string;
  address: string;
  chain: string;
  riskScore: number;
  riskCategory: string;
  exposureBreakdown: Record<string, number>;
  flaggedIndicators: string[];
  confidenceLevel: string;
  resolutionLayer: string;
  lastScoredAt: string | null;
  scoreHistory: { riskScore: number; riskCategory: string; createdAt: string }[];
}

const EXPOSURE_COLORS: Record<string, string> = {
  sanctioned: "bg-red-500",
  mixer: "bg-amber-500",
  gambling: "bg-purple-500",
  exchange: "bg-blue-500",
  unknown: "bg-gray-400",
  defi: "bg-emerald-500",
  p2p: "bg-cyan-500",
};

function getExposureColor(key: string): string {
  return EXPOSURE_COLORS[key] || "bg-gray-400";
}

function getRiskLabelAndColor(score: number): {
  label: string;
  textClass: string;
  gaugeColor: string;
  badgeVariant: "success" | "warning" | "danger";
} {
  if (score <= 20)
    return { label: "LOW", textClass: "text-emerald-600", gaugeColor: "stroke-emerald-500", badgeVariant: "success" };
  if (score <= 40)
    return { label: "MEDIUM", textClass: "text-amber-600", gaugeColor: "stroke-amber-500", badgeVariant: "warning" };
  if (score <= 60)
    return { label: "HIGH", textClass: "text-orange-600", gaugeColor: "stroke-orange-500", badgeVariant: "danger" };
  if (score <= 80)
    return { label: "HIGH", textClass: "text-red-600", gaugeColor: "stroke-red-500", badgeVariant: "danger" };
  return { label: "SEVERE", textClass: "text-red-800", gaugeColor: "stroke-red-700", badgeVariant: "danger" };
}

function layerLabel(layer: string): string {
  if (layer === "layer_1") return "L1 Blockscout";
  if (layer === "layer_2") return "L2 Subsquid";
  if (layer === "layer_3") return "L3 Commercial";
  return layer.replace(/_/g, " ");
}

function layerBadgeColor(layer: string): string {
  if (layer === "layer_1") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300";
  if (layer === "layer_2") return "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300";
  if (layer === "layer_3") return "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300";
  return "bg-gray-100 text-gray-700";
}

function RiskGauge({ score }: { score: number }) {
  const { gaugeColor } = getRiskLabelAndColor(score);
  const radius = 60;
  const circumference = Math.PI * radius; // semi-circle
  const progress = (score / 100) * circumference;

  return (
    <svg viewBox="0 0 140 80" className="w-48 h-auto">
      {/* Background arc */}
      <path
        d="M 10 75 A 60 60 0 0 1 130 75"
        fill="none"
        className="stroke-muted"
        strokeWidth="10"
        strokeLinecap="round"
      />
      {/* Score arc */}
      <path
        d="M 10 75 A 60 60 0 0 1 130 75"
        fill="none"
        className={gaugeColor}
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={`${progress} ${circumference}`}
      />
    </svg>
  );
}

export default function WalletDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const address = decodeURIComponent((params.address as string) ?? "");
  const chain = searchParams.get("chain") ?? "ethereum";

  const [wallet, setWallet] = useState<WalletDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [rescoring, setRescoring] = useState(false);

  const fetchWallet = () => {
    setLoading(true);
    setNotFound(false);
    apiRequest<WalletDetail>(`/wallets/${encodeURIComponent(address)}?chain=${chain}`)
      .then((data) => setWallet(data))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchWallet();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, chain]);

  const handleRescore = async () => {
    setRescoring(true);
    try {
      await apiRequest("/wallets/score", {
        method: "POST",
        body: JSON.stringify({ address, chain, depth: "layer_2" }),
      });
      toast.success("Re-score triggered. Refreshing...");
      fetchWallet();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to re-score wallet");
    } finally {
      setRescoring(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Card>
          <CardContent className="py-12">
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (notFound || !wallet) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Wallet not found. Score it first from the Wallet Checks page.
          </CardContent>
        </Card>
      </div>
    );
  }

  const { label, textClass, badgeVariant } = getRiskLabelAndColor(wallet.riskScore);
  const exposure = wallet.exposureBreakdown ?? {};
  const exposureTotal = Object.values(exposure).reduce((a, b) => a + b, 0) || 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/analytics/wallets">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to wallets
            </Button>
          </Link>
        </div>
        <Button variant="outline" size="sm" onClick={handleRescore} disabled={rescoring}>
          {rescoring ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Re-score
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column: risk + exposure + history */}
        <div className="lg:col-span-2 space-y-6">
          {/* Risk Assessment Card */}
          <Card>
            <CardHeader>
              <CardTitle>Risk Assessment</CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${layerBadgeColor(wallet.resolutionLayer)}`}>
                  {layerLabel(wallet.resolutionLayer)}
                </span>
                <span className="text-sm text-muted-foreground">
                  Confidence: {wallet.confidenceLevel}
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center gap-2 py-4">
                <RiskGauge score={wallet.riskScore} />
                <div className={`text-5xl font-bold ${textClass}`}>{wallet.riskScore}</div>
                <Badge variant={badgeVariant} className="text-sm">
                  {label}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Exposure Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Exposure Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Colored bar */}
              {Object.keys(exposure).length > 0 ? (
                <>
                  <div className="flex h-6 w-full overflow-hidden rounded-full">
                    {Object.entries(exposure).map(([key, value]) => (
                      <div
                        key={key}
                        className={`${getExposureColor(key)} transition-all`}
                        style={{ width: `${(value / exposureTotal) * 100}%` }}
                        title={`${key}: ${value}%`}
                      />
                    ))}
                  </div>
                  {/* Legend */}
                  <div className="flex flex-wrap gap-4">
                    {Object.entries(exposure).map(([key, value]) => (
                      <div key={key} className="flex items-center gap-2 text-sm">
                        <div className={`h-3 w-3 rounded-full ${getExposureColor(key)}`} />
                        <span className="capitalize">{key}</span>
                        <span className="text-muted-foreground">{typeof value === "number" ? `${value}%` : value}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-muted-foreground text-sm">No exposure data available</p>
              )}
            </CardContent>
          </Card>

          {/* Flagged Indicators */}
          {wallet.flaggedIndicators?.length > 0 && (
            <Card className="border-red-200 dark:border-red-900">
              <CardHeader>
                <CardTitle className="text-red-700 dark:text-red-300">Flagged Indicators</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {wallet.flaggedIndicators.map((f) => (
                    <Badge key={f} variant="destructive">
                      {f.replace(/_/g, " ")}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Score History */}
          {wallet.scoreHistory?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Score History</CardTitle>
                <p className="text-sm text-muted-foreground">Previous risk assessments</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {wallet.scoreHistory.map((h, i) => {
                    const hRisk = getRiskLabelAndColor(h.riskScore);
                    return (
                      <div
                        key={i}
                        className="flex items-center justify-between rounded border px-3 py-2 text-sm"
                      >
                        <div className="flex items-center gap-3">
                          <span className={`font-bold ${hRisk.textClass}`}>{h.riskScore}</span>
                          <Badge variant={hRisk.badgeVariant}>{h.riskCategory}</Badge>
                        </div>
                        <span className="text-muted-foreground">
                          {new Date(h.createdAt).toLocaleString()}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right column: wallet details */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Wallet Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Address</p>
                <p className="break-all font-mono text-sm">{wallet.address}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Chain</p>
                <Badge variant="outline">{wallet.chain}</Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Resolution Layer</p>
                <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${layerBadgeColor(wallet.resolutionLayer)}`}>
                  {layerLabel(wallet.resolutionLayer)}
                </span>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Last Scored</p>
                <p className="text-sm">
                  {wallet.lastScoredAt
                    ? new Date(wallet.lastScoredAt).toLocaleString()
                    : "\u2014"}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
