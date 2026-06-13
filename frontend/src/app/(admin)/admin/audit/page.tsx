"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiRequest } from "@/lib/api";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";

type AuditEntry = {
  id: string;
  tenantId: string;
  tenant_id?: string;
  tenantName: string;
  tenant_name?: string;
  user: string;
  user_name?: string;
  action: string;
  resourceType: string;
  resource_type?: string;
  resourceId: string;
  resource_id?: string;
  createdAt: string;
  created_at?: string;
  payload?: Record<string, unknown>;
};

interface TenantOption {
  id: string;
  name: string;
}

function normalizeEntry(e: any): AuditEntry {
  return {
    id: e.id,
    tenantId: e.tenantId || e.tenant_id || "",
    tenantName: e.tenantName || e.tenant_name || "",
    user: e.user || e.user_name || "",
    action: e.action || "",
    resourceType: e.resourceType || e.resource_type || "",
    resourceId: e.resourceId || e.resource_id || "",
    createdAt: e.createdAt || e.created_at || "",
    payload: e.payload || e.details || null,
  };
}

export default function AdminAuditPage() {
  const [tenantFilter, setTenantFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [resourceTypeFilter, setResourceTypeFilter] = useState("");
  const [dateRange, setDateRange] = useState("30");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [tenants, setTenants] = useState<TenantOption[]>([]);

  const fetchTenants = useCallback(async () => {
    try {
      const res = await apiRequest<any>("/admin/tenants");
      const list = Array.isArray(res) ? res : res?.items || res?.tenants || [];
      setTenants(list.map((t: any) => ({ id: t.id, name: t.name })));
    } catch {
      // silently fail
    }
  }, []);

  const fetchAudit = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: String(page),
        perPage: String(perPage),
        dateRange,
      });
      if (tenantFilter) params.set("tenantId", tenantFilter);
      if (actionFilter) params.set("action", actionFilter);
      if (resourceTypeFilter) params.set("resourceType", resourceTypeFilter);

      const data = await apiRequest<any>(`/admin/audit?${params.toString()}`);
      const list = data?.items || data?.entries || (Array.isArray(data) ? data : []);
      setEntries(list.map(normalizeEntry));
      setTotal(data?.total ?? data?.meta?.total ?? list.length);
    } catch (err: any) {
      toast.error("Failed to load audit log: " + (err.message || "Unknown error"));
    } finally {
      setLoading(false);
    }
  }, [page, perPage, dateRange, tenantFilter, actionFilter, resourceTypeFilter]);

  useEffect(() => {
    fetchTenants();
  }, [fetchTenants]);

  useEffect(() => {
    fetchAudit();
  }, [fetchAudit]);

  const totalPages = Math.ceil(total / perPage) || 1;
  const start = (page - 1) * perPage;
  const end = Math.min(start + entries.length, total);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Audit Log</h1>
        <p className="text-muted-foreground">Cross-tenant activity log</p>
      </div>
      <Card>
        <CardHeader className="flex flex-row items-center gap-4 flex-wrap">
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={tenantFilter}
            onChange={(e) => { setTenantFilter(e.target.value); setPage(1); }}
          >
            <option value="">All tenants</option>
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={actionFilter}
            onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
          >
            <option value="">All actions</option>
            <option value="screening.check">screening.check</option>
            <option value="isar.approve">isar.approve</option>
            <option value="tenant.update">tenant.update</option>
            <option value="tenant.create">tenant.create</option>
            <option value="kyc.status_change">kyc.status_change</option>
            <option value="screening.disposition">screening.disposition</option>
            <option value="case.create">case.create</option>
          </select>
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={resourceTypeFilter}
            onChange={(e) => { setResourceTypeFilter(e.target.value); setPage(1); }}
          >
            <option value="">All resource types</option>
            <option value="customer">Customer</option>
            <option value="screening_result">Screening Result</option>
            <option value="case">Case</option>
            <option value="tenant">Tenant</option>
            <option value="isar">ISAR</option>
          </select>
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={dateRange}
            onChange={(e) => { setDateRange(e.target.value); setPage(1); }}
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
          </select>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10"></TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Tenant</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Resource</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                          No audit entries
                        </TableCell>
                      </TableRow>
                    ) : (
                      entries.map((row) => (
                        <>
                          <TableRow
                            key={row.id}
                            className="cursor-pointer"
                            onClick={() => setExpandedId(expandedId === row.id ? null : row.id)}
                          >
                            <TableCell className="w-10">
                              {row.payload ? (
                                expandedId === row.id ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                )
                              ) : null}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {new Date(row.createdAt).toLocaleString()}
                            </TableCell>
                            <TableCell>{row.tenantName}</TableCell>
                            <TableCell>{row.user}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{row.action}</Badge>
                            </TableCell>
                            <TableCell>
                              {row.resourceType} / {row.resourceId}
                            </TableCell>
                          </TableRow>
                          {expandedId === row.id && row.payload && (
                            <TableRow key={`${row.id}-expanded`}>
                              <TableCell colSpan={6} className="bg-muted/30 p-4">
                                <p className="mb-2 text-xs font-medium text-muted-foreground">Payload JSON</p>
                                <pre className="overflow-x-auto rounded bg-background p-3 text-xs">
                                  {JSON.stringify(row.payload, null, 2)}
                                </pre>
                              </TableCell>
                            </TableRow>
                          )}
                        </>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
              {total > 0 && (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>Showing {start + 1}–{end} of {total}</span>
                    <select
                      className="h-8 rounded-md border bg-background px-2 text-sm"
                      value={perPage}
                      onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }}
                    >
                      <option value={10}>10 per page</option>
                      <option value={25}>25 per page</option>
                      <option value={50}>50 per page</option>
                      <option value={100}>100 per page</option>
                    </select>
                  </div>
                  {totalPages > 1 && (
                    <div className="flex gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={page <= 1}
                        onClick={() => setPage(page - 1)}
                      >
                        Previous
                      </Button>
                      <span className="flex items-center px-2 text-sm">
                        Page {page} of {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={page >= totalPages}
                        onClick={() => setPage(page + 1)}
                      >
                        Next
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
