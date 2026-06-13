"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiRequest } from "@/lib/api";
import { toast } from "sonner";
import { Copy, Key, Loader2, Plus, Trash2 } from "lucide-react";

interface ApiKeyInfo {
  id: string;
  prefix: string;
  last_four: string;
  created_at: string;
  is_active: boolean;
}

interface CreateKeyResponse {
  id: string;
  key: string;
  prefix: string;
  last_four: string;
  created_at: string;
}

export default function SettingsApiKeysPage() {
  const [keys, setKeys] = useState<ApiKeyInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create key dialog
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [showNewKeyDialog, setShowNewKeyDialog] = useState(false);

  // Revoke dialog
  const [revokeKey, setRevokeKey] = useState<ApiKeyInfo | null>(null);
  const [revoking, setRevoking] = useState(false);

  const fetchKeys = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<ApiKeyInfo[] | { items: ApiKeyInfo[] }>("/tenants/me/api-keys");
      const items = Array.isArray(data) ? data : (data.items ?? []);
      setKeys(items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load API keys");
      setKeys([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  const handleCreateKey = async () => {
    setCreating(true);
    try {
      const result = await apiRequest<CreateKeyResponse>("/tenants/me/api-keys", {
        method: "POST",
        body: JSON.stringify({}),
      });
      setNewKey(result.key);
      setShowNewKeyDialog(true);
      fetchKeys();
      toast.success("API key created");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create API key");
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async () => {
    if (!revokeKey) return;
    setRevoking(true);
    try {
      await apiRequest(`/tenants/me/api-keys`, {
        method: "DELETE",
        body: JSON.stringify({ key_id: revokeKey.id }),
      });
      toast.success("API key revoked");
      setRevokeKey(null);
      fetchKeys();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to revoke API key");
    } finally {
      setRevoking(false);
    }
  };

  const handleCopyKey = () => {
    if (newKey) {
      navigator.clipboard.writeText(newKey);
      toast.success("Copied to clipboard");
    }
  };

  const closeNewKeyDialog = () => {
    setShowNewKeyDialog(false);
    setNewKey(null);
  };

  const activeKeys = keys.filter((k) => k.is_active);
  const hasActiveKey = activeKeys.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">API Keys</h1>
        <p className="text-muted-foreground">Manage API keys for programmatic access</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>API Keys</CardTitle>
            <CardDescription>
              {loading
                ? "Loading..."
                : hasActiveKey
                  ? `${activeKeys.length} active key${activeKeys.length !== 1 ? "s" : ""}`
                  : "No active keys"}
            </CardDescription>
          </div>
          <Button onClick={handleCreateKey} disabled={creating || loading}>
            {creating ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-2 h-4 w-4" />
            )}
            Create Key
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Loading API keys...
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-destructive">{error}</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={fetchKeys}>
                Retry
              </Button>
            </div>
          ) : keys.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Key className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No API keys</p>
              <p className="text-sm text-muted-foreground mt-1">
                Create an API key to enable programmatic access.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {keys.map((k) => (
                <div
                  key={k.id}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="flex items-center gap-3">
                    <Key className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-mono text-sm">
                        {k.prefix}_...{k.last_four}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Created {new Date(k.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={k.is_active ? "success" : "secondary"}>
                      {k.is_active ? "Active" : "Revoked"}
                    </Badge>
                    {k.is_active && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => setRevokeKey(k)}
                      >
                        <Trash2 className="mr-1 h-4 w-4" />
                        Revoke
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* New Key Dialog */}
      <Dialog open={showNewKeyDialog} onOpenChange={(open) => !open && closeNewKeyDialog()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>API Key Created</DialogTitle>
            <DialogDescription>
              Copy this key now. It will only be shown once and cannot be retrieved later.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 dark:border-amber-900 dark:bg-amber-950/20">
              <p className="text-xs font-medium text-amber-800 dark:text-amber-200 mb-2">
                This key is shown only once
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 break-all rounded bg-background p-2 font-mono text-sm border">
                  {newKey}
                </code>
                <Button variant="outline" size="sm" onClick={handleCopyKey}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={closeNewKeyDialog}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke Confirmation */}
      <AlertDialog open={!!revokeKey} onOpenChange={(open) => !open && setRevokeKey(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke API key?</AlertDialogTitle>
            <AlertDialogDescription>
              Revoking this key ({revokeKey?.prefix}_...{revokeKey?.last_four}) will immediately
              invalidate it. Any integrations using it will stop working. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revoking}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevoke}
              disabled={revoking}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {revoking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Revoke key
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
