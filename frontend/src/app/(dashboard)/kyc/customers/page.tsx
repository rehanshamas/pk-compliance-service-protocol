"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/tables/data-table";
import { HelpTooltip } from "@/components/compliance/help-tooltip";
import {
  listCustomers,
  type Customer,
  type KycStatus,
  type RiskTier,
} from "@/lib/kyc-api";
import { Search } from "lucide-react";

function getKycBadgeVariant(status: KycStatus): "success" | "warning" | "danger" | "secondary" | "purple" {
  if (status === "approved") return "success";
  if (status === "rejected") return "danger";
  if (["edd_required", "edd_in_progress"].includes(status)) return "purple";
  if (["initiated", "documents_uploaded", "identity_verified", "liveness_checked", "risk_scored"].includes(status)) return "warning";
  return "secondary";
}

function getRiskBadgeVariant(tier: RiskTier): "success" | "warning" | "danger" | "secondary" {
  if (tier === "low") return "success";
  if (tier === "medium") return "warning";
  if (tier === "high") return "danger";
  return "secondary";
}

export default function KycCustomersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("q") ?? "");

  const statusFilter = searchParams.get("status") ?? "";
  const riskFilter = searchParams.get("risk") ?? "";
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [sortKey, setSortKey] = useState<keyof Customer>("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const [items, setItems] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    listCustomers({
      limit: 200,
      offset: 0,
      status: statusFilter || undefined,
      risk_tier: riskFilter || undefined,
    })
      .then((res) => {
        setItems(res.items);
        setTotal(res.total);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load customers"))
      .finally(() => setLoading(false));
  }, [statusFilter, riskFilter]);

  const filteredData = useMemo(() => {
    if (!search) return items;
    const s = search.toLowerCase();
    return items.filter(
      (c) =>
        c.fullName.toLowerCase().includes(s) ||
        (c.cnicNumber ?? "").includes(s)
    );
  }, [items, search]);

  const sortedData = useMemo(() => {
    const sorted = [...filteredData].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (typeof aVal === "string" && typeof bVal === "string")
        return sortOrder === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      if (typeof aVal === "number" && typeof bVal === "number")
        return sortOrder === "asc" ? aVal - bVal : bVal - aVal;
      const aStr = String(aVal ?? "");
      const bStr = String(bVal ?? "");
      return sortOrder === "asc" ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
    });
    return sorted;
  }, [filteredData, sortKey, sortOrder]);

  const paginatedData = useMemo(() => {
    const start = (page - 1) * perPage;
    return sortedData.slice(start, start + perPage);
  }, [sortedData, page, perPage]);

  const columns = [
    {
      key: "fullName" as const,
      label: "Name",
      sortable: true,
      render: (row: Customer) => (
        <span className="font-medium">{row.fullName}</span>
      ),
    },
    {
      key: "cnicNumber" as const,
      label: "CNIC",
      sortable: true,
      render: (row: Customer) => (
        <span className="font-mono text-sm">{row.cnicNumber ?? "—"}</span>
      ),
    },
    {
      key: "riskTier" as const,
      label: "Risk",
      sortable: true,
      render: (row: Customer) => (
        <Badge variant={getRiskBadgeVariant(row.riskTier)}>{row.riskTier}</Badge>
      ),
    },
    {
      key: "kycStatus" as const,
      label: "KYC Status",
      sortable: true,
      render: (row: Customer) => (
        <Badge variant={getKycBadgeVariant(row.kycStatus)}>
          {row.kycStatus.replace(/_/g, " ")}
        </Badge>
      ),
    },
    {
      key: "createdAt" as const,
      label: "Created",
      sortable: true,
      render: (row: Customer) => (
        <span className="text-muted-foreground text-sm">
          {new Date(row.createdAt).toLocaleDateString()}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Customers</h1>
        <p className="text-sm text-muted-foreground inline-flex items-center gap-1">
          <HelpTooltip term="KYC" /> pipeline and customer onboarding · <HelpTooltip term="EDD" /> when high risk
        </p>
      </div>
      <Card className="overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between gap-4 border-b border-border/50">
          <div className="flex flex-1 items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name or CNIC..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <select
              className="h-10 rounded-lg border border-input bg-background px-3 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              value={statusFilter}
              onChange={(e) => {
                const params = new URLSearchParams(searchParams);
                if (e.target.value) params.set("status", e.target.value);
                else params.delete("status");
                router.push(`/kyc/customers?${params}`);
              }}
            >
              <option value="">All statuses</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="initiated">Initiated</option>
              <option value="documents_uploaded">Documents Uploaded</option>
              <option value="edd_required">EDD Required</option>
            </select>
            <select
              className="h-10 rounded-lg border border-input bg-background px-3 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              value={riskFilter}
              onChange={(e) => {
                const params = new URLSearchParams(searchParams);
                if (e.target.value) params.set("risk", e.target.value);
                else params.delete("risk");
                router.push(`/kyc/customers?${params}`);
              }}
            >
              <option value="">All risk tiers</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="prohibited">Prohibited</option>
            </select>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <p className="mb-4 text-sm text-destructive">{error}</p>
          )}
          <DataTable
            columns={columns}
            data={paginatedData}
            loading={loading}
            sortKey={sortKey}
            sortOrder={sortOrder}
            onSort={(key) => {
              setSortKey(key as keyof Customer);
              setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
            }}
            page={page}
            perPage={perPage}
            total={search ? filteredData.length : total}
            onPageChange={setPage}
            onPerPageChange={(v) => {
              setPerPage(v);
              setPage(1);
            }}
            onRowClick={(row) => router.push(`/kyc/customers/${row.id}`)}
            emptyMessage={loading ? "Loading..." : "No customers found"}
            emptyAction={
              <Button variant="outline" onClick={() => router.push("/kyc/customers/new")}>
                Add Customer
              </Button>
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
