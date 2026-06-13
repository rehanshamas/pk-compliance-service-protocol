"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/tables/data-table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/api";

interface WalletListItem {
  id: string;
  address: string;
  chain: string;
  riskScore: number;
  riskCategory: string;
  confidenceLevel: string;
  resolutionLayer: string;
  lastScoredAt: string | null;
  createdAt: string;
}

interface WalletScoreResult {
  address: string;
  chain: string;
  riskScore: number;
  riskCategory: string;
  resolutionLayer: string;
  confidenceLevel: string;
  exposureBreakdown: Record<string, number>;
  flaggedIndicators: string[];
  cached: boolean;
}

function getRiskVariant(c: string): "success" | "warning" | "danger" | "secondary" {
  if (c === "low") return "success";
  if (c === "medium") return "warning";
  if (c === "high" || c === "severe") return "danger";
  return "secondary";
}

function truncateAddress(addr: string) {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
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

const DEPTH_OPTIONS = [
  { value: "layer_1", label: "Quick (L1 only)" },
  { value: "layer_2", label: "Standard (L1+L2)" },
  { value: "layer_3", label: "Deep (L1+L2+L3)" },
];

export default function AnalyticsWalletsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const riskFilter = searchParams.get("risk") ?? "";
  const chainFilter = searchParams.get("chain") ?? "";

  const [wallets, setWallets] = useState<WalletListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const perPage = 25;
  const [checkOpen, setCheckOpen] = useState(false);
  const [checkAddress, setCheckAddress] = useState("");
  const [checkChain, setCheckChain] = useState("ethereum");
  const [checkDepth, setCheckDepth] = useState("layer_2");
  const [checkLoading, setCheckLoading] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [scoreResult, setScoreResult] = useState<WalletScoreResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams();
    params.set("limit", String(perPage));
    params.set("offset", String((page - 1) * perPage));
    if (riskFilter) params.set("riskCategory", riskFilter);
    if (chainFilter) params.set("chain", chainFilter);
    apiRequest<{ items: WalletListItem[]; total: number }>(`/wallets?${params}`)
      .then((res) => {
        if (!cancelled) {
          setWallets(res.items ?? []);
          setTotal(res.total ?? 0);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setWallets([]);
          setTotal(0);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page, riskFilter, chainFilter]);

  const handleCheckWallet = async () => {
    const addr = checkAddress.trim();
    if (!addr || addr.length < 10) {
      setCheckError("Enter a valid wallet address");
      return;
    }
    setCheckError(null);
    setCheckLoading(true);
    setScoreResult(null);
    try {
      const score = await apiRequest<WalletScoreResult>(
        "/wallets/score",
        {
          method: "POST",
          body: JSON.stringify({ address: addr, chain: checkChain, depth: checkDepth }),
        }
      );
      setScoreResult(score);
    } catch (e) {
      setCheckError(e instanceof Error ? e.message : "Failed to score wallet");
    } finally {
      setCheckLoading(false);
    }
  };

  const handleCloseDialog = () => {
    setCheckOpen(false);
    setCheckAddress("");
    setCheckChain("ethereum");
    setCheckDepth("layer_2");
    setScoreResult(null);
    setCheckError(null);
  };

  const handleViewDetail = () => {
    if (scoreResult) {
      router.push(
        `/analytics/wallets/${encodeURIComponent(scoreResult.address)}?chain=${scoreResult.chain}`
      );
    }
  };

  const columns = [
    {
      key: "address" as const,
      label: "Address",
      sortable: true,
      render: (row: WalletListItem) => (
        <span className="font-mono text-sm">{truncateAddress(row.address)}</span>
      ),
    },
    {
      key: "chain" as const,
      label: "Chain",
      sortable: true,
      render: (row: WalletListItem) => (
        <Badge variant="outline">{row.chain}</Badge>
      ),
    },
    {
      key: "riskScore" as const,
      label: "Risk Score",
      sortable: true,
      render: (row: WalletListItem) => (
        <div className="flex items-center gap-2">
          <div className="h-2 w-16 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-2 rounded-full ${row.riskScore <= 20 ? "bg-emerald-500" : row.riskScore <= 60 ? "bg-amber-500" : "bg-red-500"}`}
              style={{ width: `${row.riskScore}%` }}
            />
          </div>
          <span className="text-sm font-medium">{row.riskScore}</span>
        </div>
      ),
    },
    {
      key: "riskCategory" as const,
      label: "Category",
      sortable: true,
      render: (row: WalletListItem) => (
        <Badge variant={getRiskVariant(row.riskCategory)}>
          {row.riskCategory}
        </Badge>
      ),
    },
    {
      key: "resolutionLayer" as const,
      label: "Layer",
      sortable: true,
      render: (row: WalletListItem) => (
        <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${layerBadgeColor(row.resolutionLayer)}`}>
          {layerLabel(row.resolutionLayer)}
        </span>
      ),
    },
    {
      key: "lastScoredAt" as const,
      label: "Last Scored",
      sortable: true,
      render: (row: WalletListItem) => (
        <span className="text-muted-foreground text-sm">
          {row.lastScoredAt
            ? new Date(row.lastScoredAt).toLocaleDateString()
            : "\u2014"}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Wallet Checks</h1>
        <p className="text-muted-foreground">On-chain wallet risk scores</p>
      </div>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div className="flex gap-4">
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={riskFilter}
              onChange={(e) => {
                const params = new URLSearchParams(searchParams);
                if (e.target.value) params.set("risk", e.target.value);
                else params.delete("risk");
                router.push(`/analytics/wallets?${params}`);
              }}
            >
              <option value="">All risk levels</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="severe">Severe</option>
            </select>
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={chainFilter}
              onChange={(e) => {
                const params = new URLSearchParams(searchParams);
                if (e.target.value) params.set("chain", e.target.value);
                else params.delete("chain");
                router.push(`/analytics/wallets?${params}`);
              }}
            >
              <option value="">All chains</option>
              <option value="ethereum">Ethereum</option>
              <option value="bitcoin">Bitcoin</option>
              <option value="bsc">BSC</option>
              <option value="polygon">Polygon</option>
              <option value="tron">Tron</option>
            </select>
          </div>
          <Button variant="outline" onClick={() => setCheckOpen(true)}>
            Check Wallet
          </Button>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={wallets}
            sortKey="lastScoredAt"
            sortOrder="desc"
            onSort={() => {}}
            page={page}
            perPage={perPage}
            total={total}
            onPageChange={setPage}
            onPerPageChange={() => {}}
            onRowClick={(row) =>
              router.push(
                `/analytics/wallets/${encodeURIComponent(row.address)}?chain=${row.chain}`
              )
            }
            loading={loading}
            emptyMessage="No wallet checks yet"
            emptyAction={
              <Button variant="outline" onClick={() => setCheckOpen(true)}>
                Check your first wallet
              </Button>
            }
          />
        </CardContent>
      </Card>

      <Dialog open={checkOpen} onOpenChange={(open) => !open && handleCloseDialog()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Check Wallet</DialogTitle>
            <DialogDescription>
              Enter a wallet address to get a risk score. Choose scan depth for analysis detail.
            </DialogDescription>
          </DialogHeader>

          {!scoreResult ? (
            <>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    placeholder="0x..."
                    value={checkAddress}
                    onChange={(e) => setCheckAddress(e.target.value)}
                    className="font-mono"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="chain">Chain</Label>
                    <select
                      id="chain"
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={checkChain}
                      onChange={(e) => setCheckChain(e.target.value)}
                    >
                      <option value="ethereum">Ethereum</option>
                      <option value="bitcoin">Bitcoin</option>
                      <option value="bsc">BSC</option>
                      <option value="polygon">Polygon</option>
                      <option value="tron">Tron</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="depth">Scan Depth</Label>
                    <select
                      id="depth"
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={checkDepth}
                      onChange={(e) => setCheckDepth(e.target.value)}
                    >
                      {DEPTH_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                {checkError && (
                  <p className="text-sm text-destructive">{checkError}</p>
                )}
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={handleCloseDialog}
                  disabled={checkLoading}
                >
                  Cancel
                </Button>
                <Button onClick={handleCheckWallet} disabled={checkLoading}>
                  {checkLoading ? "Scoring..." : "Score"}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <div className="space-y-4 py-4">
                {/* Score header */}
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <p className="font-mono text-sm">{truncateAddress(scoreResult.address)}</p>
                    <p className="text-xs text-muted-foreground">{scoreResult.chain}</p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold">{scoreResult.riskScore}</span>
                      <Badge variant={getRiskVariant(scoreResult.riskCategory)}>
                        {scoreResult.riskCategory}
                      </Badge>
                    </div>
                    {scoreResult.cached && (
                      <span className="text-xs text-muted-foreground">(cached)</span>
                    )}
                  </div>
                </div>

                {/* Resolution layer */}
                <div className="rounded-lg border p-4">
                  <p className="mb-2 text-sm font-medium">Resolution Layer</p>
                  <span className={`inline-flex items-center rounded px-2 py-1 text-sm font-medium ${layerBadgeColor(scoreResult.resolutionLayer)}`}>
                    {layerLabel(scoreResult.resolutionLayer)}
                  </span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    Confidence: {scoreResult.confidenceLevel}
                  </span>
                </div>

                {/* Exposure breakdown */}
                <div className="rounded-lg border p-4">
                  <p className="mb-3 text-sm font-medium">Exposure Breakdown</p>
                  <div className="space-y-2">
                    {Object.entries(scoreResult.exposureBreakdown).map(([key, value]) => (
                      <div key={key} className="flex items-center gap-2">
                        <span className="w-24 text-xs capitalize text-muted-foreground">{key}</span>
                        <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className={`h-2 rounded-full ${
                              key === "sanctioned"
                                ? "bg-red-500"
                                : key === "mixer"
                                ? "bg-amber-500"
                                : key === "gambling"
                                ? "bg-purple-500"
                                : key === "exchange"
                                ? "bg-blue-500"
                                : "bg-gray-400"
                            }`}
                            style={{ width: `${value}%` }}
                          />
                        </div>
                        <span className="w-10 text-right text-xs font-medium">{value}%</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Flagged indicators */}
                {scoreResult.flaggedIndicators.length > 0 && (
                  <div className="rounded-lg border border-red-200 bg-red-50/50 p-4 dark:border-red-900 dark:bg-red-950/20">
                    <p className="mb-2 text-sm font-medium text-red-800 dark:text-red-200">Flagged Indicators</p>
                    <div className="flex flex-wrap gap-2">
                      {scoreResult.flaggedIndicators.map((flag) => (
                        <span
                          key={flag}
                          className="inline-flex items-center rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/40 dark:text-red-300"
                        >
                          {flag.replace(/_/g, " ")}
                        </span>
                      ))}
                    </div>
                    {scoreResult.flaggedIndicators.includes("SANCTIONS_MATCH") && (
                      <p className="mt-2 text-xs font-medium text-red-700 dark:text-red-300">
                        This address is on a sanctions list. Direct match detected.
                      </p>
                    )}
                    {scoreResult.flaggedIndicators.includes("SANCTIONED_COUNTERPARTY") && (
                      <p className="mt-2 text-xs text-red-600 dark:text-red-400">
                        One or more counterparties of this address are sanctioned.
                      </p>
                    )}
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={handleCloseDialog}>
                  Close
                </Button>
                <Button onClick={handleViewDetail}>
                  View Full Detail
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
