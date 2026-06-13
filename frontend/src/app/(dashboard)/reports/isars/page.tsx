"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/tables/data-table";
import { HelpTooltip } from "@/components/compliance/help-tooltip";
import Link from "next/link";
import { apiRequest } from "@/lib/api";

interface Isar {
  id: string;
  subject_name?: string;
  subjectName?: string;
  suspicion_type?: string;
  suspicionType?: string;
  status: string;
  submitted_by?: string | null;
  submittedBy?: string | null;
  created_at?: string;
  createdAt?: string;
}

function norm(r: Isar) {
  return {
    id: r.id,
    subjectName: r.subject_name ?? r.subjectName ?? "",
    suspicionType: r.suspicion_type ?? r.suspicionType ?? "",
    status: r.status,
    submittedBy: r.submitted_by ?? r.submittedBy ?? null,
    createdAt: r.created_at ?? r.createdAt ?? "",
  };
}

type NormIsar = ReturnType<typeof norm>;

function getStatusVariant(s: string): "success" | "danger" | "warning" | "secondary" | "purple" {
  if (s === "approved" || s === "filed_as_str") return "success";
  if (s === "rejected") return "danger";
  if (s === "submitted_for_review") return "warning";
  if (s === "draft") return "secondary";
  return "purple";
}

export default function IsarsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const statusFilter = searchParams.get("status") ?? "";

  const [isars, setIsars] = useState<NormIsar[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchIsars = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = statusFilter ? `?status=${statusFilter}` : "";
      const res = await apiRequest<Isar[] | { items: Isar[] }>(`/isars${params}`);
      const list = Array.isArray(res) ? res : (res as any).items ?? [];
      setIsars(list.map(norm));
    } catch (e: any) {
      setError(e.message || "Failed to load ISARs");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchIsars();
  }, [fetchIsars]);

  const columns = [
    {
      key: "id" as const,
      label: "ISAR ID",
      sortable: true,
      render: (row: NormIsar) => (
        <span className="font-mono text-sm">{row.id}</span>
      ),
    },
    {
      key: "subjectName" as const,
      label: "Subject",
      sortable: true,
      render: (row: NormIsar) => <span className="font-medium">{row.subjectName}</span>,
    },
    {
      key: "suspicionType" as const,
      label: "Type",
      sortable: true,
      render: (row: NormIsar) => <span>{row.suspicionType}</span>,
    },
    {
      key: "status" as const,
      label: "Status",
      sortable: true,
      render: (row: NormIsar) => (
        <Badge variant={getStatusVariant(row.status)}>
          {row.status.replace(/_/g, " ")}
        </Badge>
      ),
    },
    {
      key: "submittedBy" as const,
      label: "Submitted By",
      sortable: true,
      render: (row: NormIsar) => (
        <span className="text-muted-foreground text-sm">{row.submittedBy ?? "—"}</span>
      ),
    },
    {
      key: "createdAt" as const,
      label: "Date",
      sortable: true,
      render: (row: NormIsar) => (
        <span className="text-muted-foreground text-sm">
          {row.createdAt ? new Date(row.createdAt).toLocaleDateString() : "—"}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold inline-flex items-center gap-2">
            ISARs
            <HelpTooltip term="ISAR" />
          </h1>
          <p className="text-muted-foreground">
            Internal Suspicious Activity Reports.{" "}
            <Link href="/docs/isar-str" className="text-primary hover:underline">Learn more</Link>
          </p>
        </div>
        <Button onClick={() => router.push("/reports/isars/new")}>Create ISAR</Button>
      </div>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={statusFilter}
            onChange={(e) => {
              const params = new URLSearchParams(searchParams);
              if (e.target.value) params.set("status", e.target.value);
              else params.delete("status");
              router.push(`/reports/isars?${params}`);
            }}
          >
            <option value="">All statuses</option>
            <option value="draft">Draft</option>
            <option value="submitted_for_review">Submitted</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="filed_as_str">Filed</option>
          </select>
        </CardHeader>
        <CardContent>
          {error && (
            <p className="mb-4 text-sm text-destructive">{error}</p>
          )}
          {loading ? (
            <p className="py-12 text-center text-muted-foreground">Loading ISARs...</p>
          ) : (
            <DataTable
              columns={columns}
              data={isars}
              sortKey="createdAt"
              sortOrder="desc"
              onSort={() => {}}
              page={1}
              perPage={25}
              total={isars.length}
              onPageChange={() => {}}
              onPerPageChange={() => {}}
              onRowClick={(row) => router.push(`/reports/isars/${row.id}`)}
              emptyMessage="No ISARs yet"
              emptyAction={
                <Button onClick={() => router.push("/reports/isars/new")}>
                  Create your first ISAR
                </Button>
              }
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
