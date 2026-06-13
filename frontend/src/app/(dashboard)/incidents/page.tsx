"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/tables/data-table";
import { apiRequest } from "@/lib/api";
import { Loader2, AlertTriangle } from "lucide-react";

interface Incident {
  id: string;
  title: string;
  severity: "critical" | "high" | "medium" | "low";
  category: string;
  status: string;
  detected_at?: string;
  notification_deadline?: string;
  report_deadline?: string;
  notification_overdue?: boolean;
  report_overdue?: boolean;
  created_at?: string;
  updated_at?: string;
}

function getSeverityVariant(s: string): "danger" | "warning" | "success" | "secondary" {
  if (s === "critical" || s === "high") return "danger";
  if (s === "medium") return "warning";
  if (s === "low") return "success";
  return "secondary";
}

function getStatusVariant(s: string): "danger" | "warning" | "success" | "info" | "secondary" {
  if (s === "detected") return "danger";
  if (s === "authority_notified" || s === "investigating") return "warning";
  if (s === "report_submitted") return "info";
  if (s === "resolved" || s === "closed") return "success";
  return "secondary";
}

function formatCategory(cat: string): string {
  return cat.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function IncidentsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const statusFilter = searchParams.get("status") ?? "";
  const severityFilter = searchParams.get("severity") ?? "";

  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchIncidents = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      params.set("limit", String(perPage));
      params.set("offset", String((page - 1) * perPage));
      if (statusFilter) params.set("status", statusFilter);
      if (severityFilter) params.set("severity", severityFilter);
      const res = await apiRequest<{ items: Incident[]; total: number } | Incident[]>(
        `/incidents?${params}`
      );
      if (Array.isArray(res)) {
        setIncidents(res);
        setTotal(res.length);
      } else {
        setIncidents(res.items ?? []);
        setTotal(res.total ?? res.items?.length ?? 0);
      }
    } catch (e: any) {
      setError(e.message || "Failed to load incidents");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, severityFilter, page, perPage]);

  useEffect(() => {
    fetchIncidents();
  }, [fetchIncidents]);

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value) params.set(key, value);
    else params.delete(key);
    setPage(1);
    router.push(`/incidents?${params}`);
  };

  const columns = [
    {
      key: "title" as const,
      label: "Title",
      sortable: true,
      render: (row: Incident) => (
        <div className="flex items-center gap-2">
          <span className="font-medium">{row.title}</span>
          {(row.notification_overdue || row.report_overdue) && (
            <AlertTriangle className="h-4 w-4 text-red-500" />
          )}
        </div>
      ),
    },
    {
      key: "severity" as const,
      label: "Severity",
      sortable: true,
      render: (row: Incident) => (
        <Badge variant={getSeverityVariant(row.severity)}>
          {row.severity}
        </Badge>
      ),
    },
    {
      key: "category" as const,
      label: "Category",
      sortable: true,
      render: (row: Incident) => (
        <span className="text-muted-foreground text-sm">{formatCategory(row.category)}</span>
      ),
    },
    {
      key: "status" as const,
      label: "Status",
      sortable: true,
      render: (row: Incident) => (
        <Badge variant={getStatusVariant(row.status)}>
          {row.status.replace(/_/g, " ")}
        </Badge>
      ),
    },
    {
      key: "detected_at" as const,
      label: "Detected",
      sortable: true,
      render: (row: Incident) => (
        <span className="text-muted-foreground text-sm">
          {row.detected_at ? new Date(row.detected_at).toLocaleString() : "—"}
        </span>
      ),
    },
    {
      key: "notification_deadline" as const,
      label: "Notification Deadline",
      sortable: true,
      render: (row: Incident) => (
        <span className={`text-sm ${row.notification_overdue ? "text-red-500 font-medium" : "text-muted-foreground"}`}>
          {row.notification_deadline
            ? new Date(row.notification_deadline).toLocaleString()
            : "—"}
          {row.notification_overdue && " (OVERDUE)"}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Incidents</h1>
          <p className="text-muted-foreground">
            Security incidents and PVARA regulatory reporting
          </p>
        </div>
        <Button onClick={() => router.push("/incidents/new")}>Report Incident</Button>
      </div>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div className="flex gap-4">
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={severityFilter}
              onChange={(e) => updateFilter("severity", e.target.value)}
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
              onChange={(e) => updateFilter("status", e.target.value)}
            >
              <option value="">All statuses</option>
              <option value="detected">Detected</option>
              <option value="authority_notified">Authority Notified</option>
              <option value="investigating">Investigating</option>
              <option value="report_submitted">Report Submitted</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <p className="mb-4 text-sm text-destructive">{error}</p>
          )}
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={incidents}
              sortKey="detected_at"
              sortOrder="desc"
              onSort={() => {}}
              page={page}
              perPage={perPage}
              total={total}
              onPageChange={setPage}
              onPerPageChange={(pp) => { setPerPage(pp); setPage(1); }}
              onRowClick={(row) => router.push(`/incidents/${row.id}`)}
              emptyMessage="No incidents reported"
              emptyAction={
                <Button onClick={() => router.push("/incidents/new")}>
                  Report Incident
                </Button>
              }
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
