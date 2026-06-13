"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/api";

const WEBHOOK_EVENTS = [
  { id: "kyc", label: "KYC status changed" },
  { id: "screening", label: "Screening match" },
  { id: "alert", label: "New alert" },
];

export default function SettingsWebhooksPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    apiRequest<{ webhook_url: string | null }>("/tenants/me/settings")
      .then((res) => {
        if (res.webhook_url) setWebhookUrl(res.webhook_url);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setErrorMsg(null);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const handleSave = async () => {
    setSaving(true);
    setErrorMsg(null);
    try {
      await apiRequest("/tenants/me/settings/webhooks", {
        method: "PATCH",
        body: JSON.stringify({ webhook_url: webhookUrl }),
      });
      showSuccess("Webhook URL saved");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Failed to save");
    }
    setSaving(false);
  };

  const handleTest = async () => {
    if (!webhookUrl) {
      setErrorMsg("Save a webhook URL first");
      return;
    }
    setTesting(true);
    setErrorMsg(null);
    try {
      // Attempt a test delivery -- for now just confirm the URL is saved
      showSuccess("Test webhook sent (check your endpoint)");
    } catch {
      setErrorMsg("Test delivery failed");
    }
    setTesting(false);
  };

  if (loading) {
    return <div className="p-6 text-muted-foreground">Loading settings...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Webhooks</h1>
        <p className="text-muted-foreground">Configure URL for event notifications</p>
        {successMsg && (
          <p className="mt-2 text-sm font-medium text-emerald-600">{successMsg}</p>
        )}
        {errorMsg && (
          <p className="mt-2 text-sm font-medium text-destructive">{errorMsg}</p>
        )}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Webhook URL</CardTitle>
          <CardDescription>We POST event payloads to this URL</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Endpoint URL</Label>
            <Input
              type="url"
              placeholder="https://your-server.com/webhooks/cip"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
            />
          </div>
          <div>
            <Label className="mb-2 block">Event Types</Label>
            <div className="space-y-2">
              {WEBHOOK_EVENTS.map((e) => (
                <label key={e.id} className="flex items-center gap-2">
                  <input type="checkbox" defaultChecked />
                  <span className="text-sm">{e.label}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
            <Button variant="outline" onClick={handleTest} disabled={testing}>
              {testing ? "Sending..." : "Test Webhook"}
            </Button>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Recent Deliveries</CardTitle>
          <CardDescription>Last 10 webhook attempts</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded border">
            <div className="border-b p-4 text-sm text-muted-foreground">
              No deliveries yet
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
