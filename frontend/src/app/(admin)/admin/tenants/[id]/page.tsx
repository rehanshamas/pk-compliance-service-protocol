"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { ArrowLeft, Key, User, AlertTriangle, Loader2, Copy, Check } from "lucide-react";

interface TenantDetail {
  id: string;
  name: string;
  slug: string;
  status: "trial" | "active" | "suspended";
  feature_flags: Record<string, boolean>;
  users_count: number;
  users?: Array<{ id: string; email: string; full_name: string; role: string }>;
  api_keys?: Array<{ id: string; key_preview: string; created_at: string }>;
  subscription?: { plan_id: string; plan_name: string } | null;
  created_at: string;
}

const FEATURE_LABELS: Record<string, string> = {
  identity: "Identity (KYC)",
  screening: "Screening",
  analytics: "Analytics",
  compliance: "Compliance",
};

export default function AdminTenantDetailPage() {
  const params = useParams();
  const router = useRouter();
  const tenantId = params.id as string;

  const [tenant, setTenant] = useState<TenantDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [status, setStatus] = useState<"trial" | "active" | "suspended">("active");
  const [featureFlags, setFeatureFlags] = useState<Record<string, boolean>>({
    identity: true,
    screening: true,
    analytics: false,
    compliance: true,
  });
  const [suspendConfirmOpen, setSuspendConfirmOpen] = useState(false);
  const [terminateConfirmOpen, setTerminateConfirmOpen] = useState(false);
  const [rotateConfirmOpen, setRotateConfirmOpen] = useState(false);
  const [rotatedKey, setRotatedKey] = useState<string | null>(null);
  const [rotatingKey, setRotatingKey] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

  const fetchTenant = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiRequest<any>(`/admin/tenants/${tenantId}`);
      const t: TenantDetail = {
        id: data.id,
        name: data.name,
        slug: data.slug || "",
        status: data.status || "active",
        feature_flags: data.feature_flags || data.featureFlags || {},
        users_count: data.users_count ?? data.usersCount ?? 0,
        users: data.users || [],
        api_keys: data.api_keys || [],
        subscription: data.subscription || null,
        created_at: data.created_at || data.createdAt || "",
      };
      setTenant(t);
      setName(t.name);
      setStatus(t.status);
      setFeatureFlags({
        identity: t.feature_flags.identity ?? true,
        screening: t.feature_flags.screening ?? true,
        analytics: t.feature_flags.analytics ?? false,
        compliance: t.feature_flags.compliance ?? true,
      });
    } catch (err: any) {
      toast.error("Failed to load tenant: " + (err.message || "Unknown error"));
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    fetchTenant();
  }, [fetchTenant]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiRequest(`/admin/tenants/${tenantId}`, {
        method: "PATCH",
        body: JSON.stringify({
          name,
          status,
          feature_flags: featureFlags,
        }),
      });
      toast.success("Tenant updated successfully");
      fetchTenant();
    } catch (err: any) {
      toast.error("Failed to save: " + (err.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  };

  const handleSuspend = async () => {
    try {
      await apiRequest(`/admin/tenants/${tenantId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "suspended" }),
      });
      setStatus("suspended");
      toast.success("Tenant suspended");
      setSuspendConfirmOpen(false);
      fetchTenant();
    } catch (err: any) {
      toast.error("Failed to suspend: " + (err.message || "Unknown error"));
      setSuspendConfirmOpen(false);
    }
  };

  const handleTerminate = async () => {
    try {
      await apiRequest(`/admin/tenants/${tenantId}`, {
        method: "DELETE",
      });
      toast.success("Tenant terminated");
      setTerminateConfirmOpen(false);
      router.push("/admin/tenants");
    } catch (err: any) {
      toast.error("Failed to terminate: " + (err.message || "Unknown error"));
      setTerminateConfirmOpen(false);
    }
  };

  const handleRotateKey = async () => {
    setRotatingKey(true);
    try {
      const res = await apiRequest<any>(`/admin/tenants/${tenantId}/rotate-api-key`, {
        method: "POST",
      });
      setRotatedKey(res.api_key || res.key || res.apiKey || "Key rotated (check tenant details)");
      toast.success("API key rotated");
      setRotateConfirmOpen(false);
    } catch (err: any) {
      toast.error("Failed to rotate key: " + (err.message || "Unknown error"));
      setRotateConfirmOpen(false);
    } finally {
      setRotatingKey(false);
    }
  };

  const handleCopyKey = () => {
    if (rotatedKey) {
      navigator.clipboard.writeText(rotatedKey);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => router.push("/admin/tenants")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Tenant not found
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => router.push("/admin/tenants")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Badge
          variant={
            status === "active"
              ? "default"
              : status === "suspended"
                ? "destructive"
                : "secondary"
          }
        >
          {status}
        </Badge>
      </div>
      <div>
        <h1 className="text-2xl font-semibold">{tenant.name}</h1>
        <p className="text-muted-foreground">Tenant configuration</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tenant Info</CardTitle>
          <CardDescription>Edit name and status</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="max-w-md"
            />
          </div>
          <div>
            <Label>Status</Label>
            <select
              className="h-10 w-full max-w-md rounded-md border border-input bg-background px-3 text-sm"
              value={status}
              onChange={(e) => {
                const v = e.target.value as "trial" | "active" | "suspended";
                if (v === "suspended") setSuspendConfirmOpen(true);
                else setStatus(v);
              }}
            >
              <option value="trial">Trial</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
          {tenant.subscription && (
            <div>
              <Label>Current Plan</Label>
              <p className="text-sm text-muted-foreground mt-1">
                {tenant.subscription.plan_name || tenant.subscription.plan_id || "No plan assigned"}
              </p>
            </div>
          )}
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save changes
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Feature Flags</CardTitle>
          <CardDescription>Enable or disable modules for this tenant</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            {Object.entries(FEATURE_LABELS).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={featureFlags[key] ?? false}
                  onChange={(e) =>
                    setFeatureFlags((prev) => ({ ...prev, [key]: e.target.checked }))
                  }
                  className="h-4 w-4 rounded border-input"
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              API Keys
            </CardTitle>
            <CardDescription>Manage API keys for programmatic access</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => setRotateConfirmOpen(true)}>
            Rotate API Key
          </Button>
        </CardHeader>
        <CardContent>
          {rotatedKey && (
            <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-950">
              <p className="mb-1 text-sm font-medium text-green-800 dark:text-green-200">
                New API Key (copy now, it will not be shown again):
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs break-all">{rotatedKey}</code>
                <Button variant="ghost" size="sm" onClick={handleCopyKey}>
                  {copiedKey ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          )}
          <div className="space-y-2 text-sm">
            {tenant.api_keys && tenant.api_keys.length > 0 ? (
              tenant.api_keys.map((key) => (
                <p key={key.id} className="text-muted-foreground">
                  {key.key_preview}
                </p>
              ))
            ) : (
              <p className="text-muted-foreground">No API keys configured</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Users
          </CardTitle>
          <CardDescription>Users for this tenant ({tenant.users_count} total)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {(!tenant.users || tenant.users.length === 0) ? (
              <p className="text-sm text-muted-foreground">No users</p>
            ) : (
              tenant.users.map((u) => (
                <div
                  key={u.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div>
                    <p className="font-medium">{u.full_name}</p>
                    <p className="text-sm text-muted-foreground">{u.email}</p>
                  </div>
                  <Badge variant="outline">{u.role}</Badge>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Danger Zone
          </CardTitle>
          <CardDescription>
            Suspend or terminate this tenant. All access will be revoked.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Button
            variant="destructive"
            onClick={() => setSuspendConfirmOpen(true)}
            disabled={status === "suspended"}
          >
            Suspend Tenant
          </Button>
          <Button
            variant="outline"
            className="text-destructive border-destructive/50"
            onClick={() => setTerminateConfirmOpen(true)}
          >
            Terminate (permanent)
          </Button>
        </CardContent>
      </Card>

      {/* Suspend Confirm */}
      <AlertDialog open={suspendConfirmOpen} onOpenChange={setSuspendConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Suspend this tenant?</AlertDialogTitle>
            <AlertDialogDescription>
              All access will be revoked. The tenant can be reactivated later. Users will not be able to log in until the tenant is active again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSuspend}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Suspend
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Terminate Confirm */}
      <AlertDialog open={terminateConfirmOpen} onOpenChange={setTerminateConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Terminate this tenant permanently?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. All data, users, and API keys will be permanently deleted. Only proceed if you are certain.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleTerminate}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Terminate permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Rotate Key Confirm */}
      <AlertDialog open={rotateConfirmOpen} onOpenChange={setRotateConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rotate API Key?</AlertDialogTitle>
            <AlertDialogDescription>
              This will invalidate the current API key and generate a new one. Any integrations using the old key will stop working immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={rotatingKey}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRotateKey} disabled={rotatingKey}>
              {rotatingKey ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Rotate Key
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
