"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DataTable } from "@/components/tables/data-table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { apiRequest } from "@/lib/api";

interface Case {
  id: string;
  tenant_id?: string;
  title: string;
  status: "open" | "investigating" | "escalated" | "closed_no_action" | "closed_str_filed";
  linked_alerts_count?: number;
  linkedAlertsCount?: number;
  assigned_to?: string | null;
  assignedTo?: string | null;
  created_at?: string;
  createdAt?: string;
  updated_at?: string;
  updatedAt?: string;
}

function norm(c: Case) {
  return {
    id: c.id,
    title: c.title,
    status: c.status,
    linkedAlertsCount: c.linked_alerts_count ?? c.linkedAlertsCount ?? 0,
    assignedTo: c.assigned_to ?? c.assignedTo ?? null,
    createdAt: c.created_at ?? c.createdAt ?? "",
    updatedAt: c.updated_at ?? c.updatedAt ?? "",
  };
}

type NormCase = ReturnType<typeof norm>;

function getStatusVariant(s: string): "warning" | "success" | "danger" | "secondary" {
  if (s === "open" || s === "investigating" || s === "escalated") return "warning";
  if (s === "closed_no_action") return "secondary";
  if (s === "closed_str_filed") return "success";
  return "secondary";
}

export default function CasesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const statusFilter = searchParams.get("status") ?? "";

  const [cases, setCases] = useState<NormCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Create case dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);

  const fetchCases = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = statusFilter ? `?status=${statusFilter}` : "";
      const res = await apiRequest<Case[] | { items: Case[] }>(`/cases${params}`);
      const list = Array.isArray(res) ? res : (res as any).items ?? [];
      setCases(list.map(norm));
    } catch (e: any) {
      setError(e.message || "Failed to load cases");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchCases();
  }, [fetchCases]);

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      const created = await apiRequest<Case>("/cases", {
        method: "POST",
        body: JSON.stringify({ title: newTitle.trim() }),
      });
      setCreateOpen(false);
      setNewTitle("");
      router.push(`/cases/${created.id}`);
    } catch (e: any) {
      alert(e.message || "Failed to create case");
    } finally {
      setCreating(false);
    }
  };

  const columns = [
    {
      key: "id" as const,
      label: "Case ID",
      sortable: true,
      render: (row: NormCase) => (
        <span className="font-mono text-sm">{row.id}</span>
      ),
    },
    {
      key: "title" as const,
      label: "Title",
      sortable: true,
      render: (row: NormCase) => (
        <span className="font-medium">{row.title}</span>
      ),
    },
    {
      key: "status" as const,
      label: "Status",
      sortable: true,
      render: (row: NormCase) => (
        <Badge variant={getStatusVariant(row.status)}>
          {row.status.replace(/_/g, " ")}
        </Badge>
      ),
    },
    {
      key: "linkedAlertsCount" as const,
      label: "Alerts",
      sortable: true,
      render: (row: NormCase) => (
        <span className="text-muted-foreground text-sm">{row.linkedAlertsCount}</span>
      ),
    },
    {
      key: "assignedTo" as const,
      label: "Assigned To",
      sortable: true,
      render: (row: NormCase) => (
        <span className="text-muted-foreground text-sm">{row.assignedTo ?? "—"}</span>
      ),
    },
    {
      key: "updatedAt" as const,
      label: "Updated",
      sortable: true,
      render: (row: NormCase) => (
        <span className="text-muted-foreground text-sm">
          {row.updatedAt ? new Date(row.updatedAt).toLocaleDateString() : "—"}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Active Cases</h1>
        <p className="text-muted-foreground">Investigation and compliance cases</p>
      </div>
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
                router.push(`/cases?${params}`);
              }}
            >
              <option value="">All statuses</option>
              <option value="open">Open</option>
              <option value="investigating">Investigating</option>
              <option value="escalated">Escalated</option>
              <option value="closed_no_action">Closed (No Action)</option>
              <option value="closed_str_filed">Closed (STR Filed)</option>
            </select>
          </div>
          <Button onClick={() => setCreateOpen(true)}>Create Case</Button>
        </CardHeader>
        <CardContent>
          {error && (
            <p className="mb-4 text-sm text-destructive">{error}</p>
          )}
          {loading ? (
            <p className="py-12 text-center text-muted-foreground">Loading cases...</p>
          ) : (
            <DataTable
              columns={columns}
              data={cases}
              sortKey="updatedAt"
              sortOrder="desc"
              onSort={() => {}}
              page={1}
              perPage={25}
              total={cases.length}
              onPageChange={() => {}}
              onPerPageChange={() => {}}
              onRowClick={(row) => router.push(`/cases/${row.id}`)}
              emptyMessage="No cases"
              emptyAction={
                <Button onClick={() => router.push("/analytics/alerts")}>
                  Create from alert
                </Button>
              }
            />
          )}
        </CardContent>
      </Card>

      {/* Create Case Dialog */}
      <AlertDialog open={createOpen} onOpenChange={setCreateOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Create New Case</AlertDialogTitle>
            <AlertDialogDescription>
              Enter a title for the new investigation case.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="case-title">Case Title</Label>
            <Input
              id="case-title"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="e.g. OFAC hit — Customer Name"
              className="mt-1"
              onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleCreate} disabled={creating || !newTitle.trim()}>
              {creating ? "Creating..." : "Create"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
