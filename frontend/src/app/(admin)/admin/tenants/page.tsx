"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { toast } from "sonner";
import { Building2, Shield, Wallet, Users, FileText, Plus, Loader2 } from "lucide-react";

interface TenantAdmin {
  id: string;
  name: string;
  slug: string;
  status: "trial" | "active" | "suspended";
  featureFlags: Record<string, boolean>;
  feature_flags?: Record<string, boolean>;
  usersCount: number;
  users_count?: number;
  createdAt: string;
  created_at?: string;
}

const FEATURE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  identity: Users,
  screening: Shield,
  analytics: Wallet,
  compliance: FileText,
};

function getTenantBadgeVariant(status: string) {
  if (status === "active") return "default";
  if (status === "suspended") return "destructive";
  return "secondary";
}

function normalizeTenant(t: any): TenantAdmin {
  return {
    id: t.id,
    name: t.name,
    slug: t.slug || "",
    status: t.status || "active",
    featureFlags: t.featureFlags || t.feature_flags || {},
    usersCount: t.usersCount ?? t.users_count ?? 0,
    createdAt: t.createdAt || t.created_at || new Date().toISOString(),
  };
}

export default function AdminTenantsPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [tenants, setTenants] = useState<TenantAdmin[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");

  const fetchTenants = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiRequest<any>("/admin/tenants");
      const list = Array.isArray(res) ? res : res?.items || res?.tenants || [];
      const normalized = list.map(normalizeTenant);
      normalized.sort(
        (a: TenantAdmin, b: TenantAdmin) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setTenants(normalized);
      setTotal(normalized.length);
    } catch (err: any) {
      toast.error("Failed to load tenants: " + (err.message || "Unknown error"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTenants();
  }, [fetchTenants]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await apiRequest("/admin/tenants", {
        method: "POST",
        body: JSON.stringify({
          name: newName.trim(),
          slug: newSlug.trim() || newName.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""),
        }),
      });
      toast.success("Tenant created successfully");
      setCreateOpen(false);
      setNewName("");
      setNewSlug("");
      fetchTenants();
    } catch (err: any) {
      toast.error("Failed to create tenant: " + (err.message || "Unknown error"));
    } finally {
      setCreating(false);
    }
  };

  const paginatedData = tenants.slice((page - 1) * perPage, page * perPage);

  const columns = [
    {
      key: "name",
      label: "Name",
      sortable: true,
      render: (row: TenantAdmin) => (
        <div className="flex items-center gap-3">
          <Building2 className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="font-medium">{row.name}</p>
            <p className="text-sm text-muted-foreground">{row.slug}</p>
          </div>
        </div>
      ),
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (row: TenantAdmin) => (
        <Badge variant={getTenantBadgeVariant(row.status)}>{row.status}</Badge>
      ),
    },
    {
      key: "featureFlags",
      label: "Features",
      sortable: false,
      render: (row: TenantAdmin) => (
        <div className="flex gap-1">
          {Object.entries(row.featureFlags)
            .filter(([, v]) => v)
            .map(([k]) => {
              const Icon = FEATURE_ICONS[k];
              return Icon ? (
                <span
                  key={k}
                  className="inline-flex items-center rounded bg-muted p-1"
                  title={k}
                >
                  <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                </span>
              ) : null;
            })}
        </div>
      ),
    },
    {
      key: "usersCount",
      label: "Users",
      sortable: true,
      render: (row: TenantAdmin) => (
        <span className="text-muted-foreground">{row.usersCount}</span>
      ),
    },
    {
      key: "createdAt",
      label: "Created",
      sortable: true,
      render: (row: TenantAdmin) => (
        <span className="text-sm text-muted-foreground">
          {new Date(row.createdAt).toLocaleDateString()}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Tenants</h1>
        <p className="text-muted-foreground">VASP tenants on the platform</p>
      </div>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>All Tenants</CardTitle>
            <CardDescription>
              {loading ? "Loading..." : `${total} tenants registered`}
            </CardDescription>
          </div>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Onboard VASP
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={paginatedData}
              sortKey="createdAt"
              sortOrder="desc"
              page={page}
              perPage={perPage}
              total={total}
              onPageChange={setPage}
              onPerPageChange={(v) => {
                setPerPage(v);
                setPage(1);
              }}
              onRowClick={(row) => router.push(`/admin/tenants/${row.id}`)}
              emptyMessage="No tenants yet"
              emptyAction={
                <Button onClick={() => setCreateOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Onboard first VASP
                </Button>
              }
              getRowId={(r) => r.id}
            />
          )}
        </CardContent>
      </Card>

      {/* Create Tenant Dialog */}
      <AlertDialog open={createOpen} onOpenChange={setCreateOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Onboard New VASP</AlertDialogTitle>
            <AlertDialogDescription>
              Create a new tenant for a VASP on the platform.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Tenant Name</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. CryptoExchange PK"
              />
            </div>
            <div>
              <Label>Slug (optional)</Label>
              <Input
                value={newSlug}
                onChange={(e) => setNewSlug(e.target.value)}
                placeholder="auto-generated from name"
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={creating}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleCreate} disabled={creating || !newName.trim()}>
              {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Create Tenant
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
