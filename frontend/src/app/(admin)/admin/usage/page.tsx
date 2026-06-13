"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api";
import { toast } from "sonner";
import { Loader2, Download } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface TenantOption {
  id: string;
  name: string;
}

interface UsageData {
  tenants?: Array<{
    tenantId: string;
    tenantName: string;
    verifications: number;
    screenings: number;
    analytics: number;
    commercialApi: number;
  }>;
  totals?: {
    verifications: number;
    screenings: number;
    analytics: number;
    commercialApi: number;
  };
  daily?: Array<{
    date: string;
    verifications: number;
    screenings: number;
    analytics: number;
  }>;
  verifications?: number;
  screenings?: number;
  analytics?: number;
  commercialApi?: number;
}

export default function AdminUsagePage() {
  const [selectedTenant, setSelectedTenant] = useState<string>("all");
  const [dateRange, setDateRange] = useState("30");
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [usageData, setUsageData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const fetchTenants = useCallback(async () => {
    try {
      const res = await apiRequest<any>("/admin/tenants");
      const list = Array.isArray(res) ? res : res?.items || res?.tenants || [];
      setTenants(list.map((t: any) => ({ id: t.id, name: t.name })));
    } catch {
      // silently fail tenant list, it's a filter helper
    }
  }, []);

  const fetchUsage = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ dateRange });
      if (selectedTenant !== "all") params.set("tenantId", selectedTenant);
      const data = await apiRequest<UsageData>(`/admin/usage?${params.toString()}`);
      setUsageData(data);
    } catch (err: any) {
      toast.error("Failed to load usage data: " + (err.message || "Unknown error"));
    } finally {
      setLoading(false);
    }
  }, [selectedTenant, dateRange]);

  useEffect(() => {
    fetchTenants();
  }, [fetchTenants]);

  useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("cip_access_token") : null;
      const params = new URLSearchParams({ dateRange });
      if (selectedTenant !== "all") params.set("tenantId", selectedTenant);
      const res = await fetch(`${API_BASE}/api/v1/admin/usage/export?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `usage-export-${dateRange}d.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success("CSV exported");
    } catch (err: any) {
      toast.error("Export failed: " + (err.message || "Unknown error"));
    } finally {
      setExporting(false);
    }
  };

  // Normalize totals from various API response shapes
  const totals = usageData?.totals || {
    verifications: usageData?.verifications ?? 0,
    screenings: usageData?.screenings ?? 0,
    analytics: usageData?.analytics ?? 0,
    commercialApi: usageData?.commercialApi ?? 0,
  };

  const dailyData = usageData?.daily || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Usage</h1>
        <p className="text-muted-foreground">Per-tenant usage metrics and billing</p>
      </div>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle>Usage Dashboard</CardTitle>
          <div className="flex gap-2">
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={selectedTenant}
              onChange={(e) => setSelectedTenant(e.target.value)}
            >
              <option value="all">All tenants</option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
            >
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
            </select>
            <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
              {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg border p-4">
                  <p className="text-sm text-muted-foreground">KYC Verifications</p>
                  <p className="text-2xl font-semibold">{totals.verifications?.toLocaleString() ?? 0}</p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-sm text-muted-foreground">Screening Calls</p>
                  <p className="text-2xl font-semibold">{totals.screenings?.toLocaleString() ?? 0}</p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-sm text-muted-foreground">Analytics Queries</p>
                  <p className="text-2xl font-semibold">{totals.analytics?.toLocaleString() ?? 0}</p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-sm text-muted-foreground">Commercial API Calls</p>
                  <p className="text-2xl font-semibold">{totals.commercialApi?.toLocaleString() ?? 0}</p>
                </div>
              </div>
              {dailyData.length > 0 && (
                <div className="h-64">
                  <p className="mb-2 text-sm font-medium">Daily breakdown</p>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dailyData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="date" className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                      <YAxis className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                      <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
                      <Legend />
                      <Bar dataKey="verifications" fill="hsl(var(--primary))" name="Verifications" radius={[2, 2, 0, 0]} />
                      <Bar dataKey="screenings" fill="hsl(142, 76%, 36%)" name="Screenings" radius={[2, 2, 0, 0]} />
                      <Bar dataKey="analytics" fill="hsl(262, 83%, 58%)" name="Analytics" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
              {dailyData.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No daily breakdown data available for the selected period.
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
