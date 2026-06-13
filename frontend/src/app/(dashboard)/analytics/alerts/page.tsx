"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/tables/data-table";
import { apiRequest } from "@/lib/api";
import type { Alert } from "@/lib/mock-data";

function getSeverityVariant(s: Alert["severity"]): "success" | "warning" | "danger" | "secondary" {
  if (s === "critical") return "danger";
  if (s === "high") return "danger";
  if (s === "medium") return "warning";
  if (s === "low") return "success";
  return "secondary";
}

function getStatusVariant(s: Alert["status"]): "warning" | "success" | "secondary" {
  if (s === "open" || s === "investigating" || s === "escalated") return "warning";
  if (s === "resolved" || s === "false_alarm") return "success";
  return "secondary";
}

export default function AnalyticsAlertsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const severityFilter = searchParams.get("severity") ?? "";
  const statusFilter = searchParams.get("status") ?? "";

  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const perPage = 25;

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams();
    params.set("limit", String(perPage));
    params.set("offset", String((page - 1) * perPage));
    if (severityFilter) params.set("severity", severityFilter);
    if (statusFilter) params.set("status", statusFilter);
    apiRequest<{ items: Alert[]; total: number }>(`/alerts?${params}`)
      .then((res) => {
        if (!cancelled) {
          setAlerts(res.items ?? []);
          setTotal(res.total ?? 0);
        }
      })
      .catch(() => {
        if (!cancelled) setAlerts([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page, severityFilter, statusFilter]);

  const filteredData = useMemo(() => alerts, [alerts]);

  const columns = [
    {
      key: "severity" as const,
      label: "Severity",
      sortable: true,
      render: (row: Alert) => (
        <Badge variant={getSeverityVariant(row.severity)}>{row.severity}</Badge>
      ),
    },
    {
      key: "source" as const,
      label: "Source",
      sortable: true,
      render: (row: Alert) => (
        <span className="text-sm">{row.source.replace(/_/g, " ")}</span>
      ),
    },
    {
      key: "summary" as const,
      label: "Summary",
      sortable: false,
      render: (row: Alert) => (
        <span className="line-clamp-1">{row.summary}</span>
      ),
    },
    {
      key: "status" as const,
      label: "Status",
      sortable: true,
      render: (row: Alert) => (
        <Badge variant={getStatusVariant(row.status)}>{row.status}</Badge>
      ),
    },
    {
      key: "assignedTo" as const,
      label: "Assigned To",
      sortable: true,
      render: (row: Alert) => (
        <span className="text-muted-foreground text-sm">{row.assignedTo ?? "—"}</span>
      ),
    },
    {
      key: "createdAt" as const,
      label: "Created",
      sortable: true,
      render: (row: Alert) => (
        <span className="text-muted-foreground text-sm">
          {new Date(row.createdAt).toLocaleDateString()}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Alerts</h1>
        <p className="text-muted-foreground">Transaction monitoring and screening alerts</p>
      </div>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div className="flex gap-4">
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={severityFilter}
              onChange={(e) => {
                const params = new URLSearchParams(searchParams);
                if (e.target.value) params.set("severity", e.target.value);
                else params.delete("severity");
                router.push(`/analytics/alerts?${params}`);
              }}
            >
              <option value="">All severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={statusFilter}
              onChange={(e) => {
                const params = new URLSearchParams(searchParams);
                if (e.target.value) params.set("status", e.target.value);
                else params.delete("status");
                router.push(`/analytics/alerts?${params}`);
              }}
            >
              <option value="">All statuses</option>
              <option value="open">Open</option>
              <option value="investigating">Investigating</option>
              <option value="escalated">Escalated</option>
              <option value="resolved">Resolved</option>
              <option value="false_alarm">False Alarm</option>
            </select>
          </div>
          <Button variant="outline" onClick={() => router.push("/cases")}>
            Create Case
          </Button>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={filteredData}
            sortKey="createdAt"
            sortOrder="desc"
            onSort={() => {}}
            page={page}
            perPage={perPage}
            total={total}
            onPageChange={(p) => setPage(p)}
            onPerPageChange={() => {}}
            onRowClick={(row) => router.push(`/cases?alert=${row.id}`)}
            loading={loading}
            emptyMessage="No alerts"
            emptyAction={
              <Button variant="outline" onClick={() => router.push("/cases")}>
                View cases
              </Button>
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
