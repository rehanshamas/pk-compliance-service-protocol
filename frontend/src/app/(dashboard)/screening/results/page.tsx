"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/tables/data-table";
import { ScreeningDispositionPanel } from "@/components/screening/disposition-panel";
import { HelpTooltip } from "@/components/compliance/help-tooltip";
import { UsageGuide } from "@/components/compliance/usage-guide";
import { apiRequest } from "@/lib/api";
import { getStoredUser } from "@/lib/auth";
import type { ScreeningResult } from "@/lib/mock-data";

function getDispositionVariant(
  s: ScreeningResult["dispositionStatus"]
): "success" | "danger" | "warning" | "purple" | "secondary" {
  if (s === "true_positive") return "danger";
  if (s === "false_positive") return "success";
  if (s === "escalated") return "purple";
  if (s === "pending") return "warning";
  return "secondary";
}

interface ScreeningApiItem {
  id: string;
  screenedEntityName: string;
  source: string | null;
  matchScore: number | null;
  dispositionStatus: string;
  createdAt: string;
}

export default function ScreeningResultsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedResult, setSelectedResult] = useState<ScreeningResult | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [apiData, setApiData] = useState<{ items: ScreeningApiItem[]; total: number } | null>(null);
  const [loading, setLoading] = useState(true);

  const statusFilter = searchParams.get("status") ?? "";
  const sourceFilter = searchParams.get("source") ?? "";
  const minScore = searchParams.get("minScore") ? Number(searchParams.get("minScore")) : null;

  useEffect(() => {
    if (!getStoredUser()) {
      setLoading(false);
      return;
    }
    const params = new URLSearchParams();
    params.set("limit", "100");
    if (statusFilter) params.set("status", statusFilter);
    apiRequest<{ items: ScreeningApiItem[]; total: number }>(`/screening/results?${params}`)
      .then((res) => setApiData(res))
      .catch(() => setApiData(null))
      .finally(() => setLoading(false));
  }, [panelOpen, statusFilter]);

  const rawData = apiData?.items ?? [];
  const tenantId = getStoredUser()?.tenantId ?? "";
  const filteredData = useMemo(() => {
    let data: ScreeningResult[] = rawData.map((item) => ({
      ...item,
      tenantId,
      source: (item.source ?? "UN") as ScreeningResult["source"],
      matchScore: item.matchScore ?? 0,
      dispositionStatus: item.dispositionStatus as ScreeningResult["dispositionStatus"],
    }));
    // statusFilter already applied server-side; filter source and minScore client-side
    if (sourceFilter) data = data.filter((c) => (c.source ?? "").toUpperCase() === sourceFilter);
    if (minScore != null) data = data.filter((c) => (c.matchScore ?? 0) >= minScore);
    return data;
  }, [rawData, sourceFilter, minScore, tenantId]);

  const handleRowClick = (row: ScreeningResult) => {
    setSelectedResult(row);
    setPanelOpen(true);
  };

  const columns = [
    {
      key: "screenedEntityName" as const,
      label: "Screened Name",
      sortable: true,
      render: (row: ScreeningResult) => (
        <span className="font-medium">{row.screenedEntityName}</span>
      ),
    },
    {
      key: "source" as const,
      label: "Source",
      sortable: true,
      render: (row: ScreeningResult) => (
        <Badge variant="outline">{(row.source ?? "").toUpperCase() || "—"}</Badge>
      ),
    },
    {
      key: "matchScore" as const,
      label: "Match Score",
      sortable: true,
        render: (row: ScreeningResult) => (
        <span className="font-mono text-sm">{row.matchScore ?? 0}%</span>
      ),
    },
    {
      key: "dispositionStatus" as const,
      label: "Disposition",
      sortable: true,
      render: (row: ScreeningResult) => (
        <Badge variant={getDispositionVariant(row.dispositionStatus)}>
          {row.dispositionStatus.replace(/_/g, " ")}
        </Badge>
      ),
    },
    {
      key: "createdAt" as const,
      label: "Date",
      sortable: true,
      render: (row: ScreeningResult) => (
        <span className="text-muted-foreground text-sm">
          {new Date(row.createdAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: "actions" as const,
      label: "",
      sortable: false,
      render: (row: ScreeningResult) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            setSelectedResult(row);
            setPanelOpen(true);
          }}
        >
          Disposition
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Screening Results</h1>
        <p className="text-muted-foreground inline-flex items-center gap-1 flex-wrap">
          Sanctions and <HelpTooltip term="PEP" /> screening matches · Filter by <HelpTooltip term="disposition" />
        </p>
      </div>
      <UsageGuide
        title="How to disposition screening matches"
        steps={[
          "Click a row to open the disposition panel.",
          "Review the screened entity and watchlist match details.",
          "Document your rationale in the text field (required).",
          "Choose: True Positive (confirmed hit), False Positive (no match), or Escalate (needs senior review).",
        ]}
      />
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div className="flex gap-4">
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={statusFilter}
              onChange={(e) => {
                const params = new URLSearchParams(searchParams);
                if (e.target.value) params.set("status", e.target.value);
                else params.delete("status");
                router.push(`/screening/results?${params}`);
              }}
            >
              <option value="">All dispositions</option>
              <option value="pending">Pending</option>
              <option value="true_positive">True Positive</option>
              <option value="false_positive">False Positive</option>
              <option value="escalated">Escalated</option>
            </select>
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={sourceFilter}
              onChange={(e) => {
                const params = new URLSearchParams(searchParams);
                if (e.target.value) params.set("source", e.target.value);
                else params.delete("source");
                router.push(`/screening/results?${params}`);
              }}
            >
              <option value="">All sources</option>
              <option value="UN">UN</option>
              <option value="OFAC">OFAC</option>
              <option value="EU">EU</option>
              <option value="NACTA">NACTA</option>
              <option value="PEP">PEP</option>
            </select>
          </div>
          <Button variant="outline" onClick={() => router.push("/screening/batch")}>
            Batch Screening
          </Button>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={filteredData}
            sortKey="createdAt"
            sortOrder="desc"
            onSort={() => {}}
            page={1}
            perPage={25}
            total={filteredData.length}
            onPageChange={() => {}}
            onPerPageChange={() => {}}
            onRowClick={handleRowClick}
            loading={loading}
            emptyMessage="No screening results"
            emptyAction={
              <Button variant="outline" onClick={() => router.push("/screening/batch")}>
                Run batch screening
              </Button>
            }
          />
        </CardContent>
      </Card>

      <ScreeningDispositionPanel
        result={selectedResult}
        open={panelOpen}
        onClose={() => {
          setPanelOpen(false);
          setSelectedResult(null);
        }}
        onDisposition={async (disposition, rationale) => {
          if (!selectedResult?.id) return;
          try {
            await apiRequest("/screening/dispositions", {
              method: "POST",
              body: JSON.stringify({
                screening_result_id: selectedResult.id,
                disposition,
                rationale: rationale || undefined,
              }),
            });
            setPanelOpen(false);
            setSelectedResult(null);
            const p = new URLSearchParams();
            p.set("limit", "100");
            if (statusFilter) p.set("status", statusFilter);
            apiRequest<{ items: ScreeningApiItem[]; total: number }>(`/screening/results?${p}`)
              .then((res) => setApiData(res))
              .catch(() => setApiData(null));
          } catch {
            // Keep panel open on error
          }
        }}
      />
    </div>
  );
}
