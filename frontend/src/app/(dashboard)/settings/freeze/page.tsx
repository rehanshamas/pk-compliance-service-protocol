"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/api";

export default function SettingsAutoFreezePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ delivered: boolean; statusCode: number | null; error?: string } | null>(null);

  const [enabled, setEnabled] = useState(false);
  const [vaspEndpoint, setVaspEndpoint] = useState("");
  const [authToken, setAuthToken] = useState("");
  const [walletRiskMin, setWalletRiskMin] = useState(80);
  const [screeningMatchMin, setScreeningMatchMin] = useState(85);
  const [sanctionsTruePositive, setSanctionsTruePositive] = useState(true);

  useEffect(() => {
    apiRequest<{ feature_flags: Record<string, unknown> }>("/tenants/me/settings")
      .then((res) => {
        const flags = res.feature_flags || {};
        const af = (flags.auto_freeze as Record<string, unknown>) || {};
        if (typeof af.enabled === "boolean") setEnabled(af.enabled);
        if (typeof af.vasp_freeze_endpoint === "string") setVaspEndpoint(af.vasp_freeze_endpoint);
        if (typeof af.vasp_freeze_auth_token === "string") setAuthToken(af.vasp_freeze_auth_token);
        const thresholds = (af.thresholds as Record<string, unknown>) || {};
        if (typeof thresholds.wallet_risk_score_min === "number") setWalletRiskMin(thresholds.wallet_risk_score_min);
        if (typeof thresholds.screening_match_score_min === "number") setScreeningMatchMin(thresholds.screening_match_score_min);
        if (typeof thresholds.sanctions_true_positive === "boolean") setSanctionsTruePositive(thresholds.sanctions_true_positive);
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
      await apiRequest("/tenants/me/settings/auto-freeze", {
        method: "PATCH",
        body: JSON.stringify({
          enabled,
          vasp_freeze_endpoint: vaspEndpoint,
          vasp_freeze_auth_token: authToken,
          thresholds: {
            wallet_risk_score_min: walletRiskMin,
            screening_match_score_min: screeningMatchMin,
            sanctions_true_positive: sanctionsTruePositive,
          },
        }),
      });
      showSuccess("Auto-freeze settings saved");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Failed to save");
    }
    setSaving(false);
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await apiRequest<{ data: { delivered: boolean; statusCode: number | null; error?: string } }>(
        "/tenants/me/settings/auto-freeze/test",
        { method: "POST" }
      );
      setTestResult((res as any).data || res);
    } catch (e) {
      setTestResult({ delivered: false, statusCode: null, error: e instanceof Error ? e.message : "Failed" });
    }
    setTesting(false);
  };

  if (loading) {
    return <div className="p-6 text-muted-foreground">Loading settings...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Auto-Freeze Configuration</h1>
        <p className="text-muted-foreground">
          Automatically freeze customer accounts when compliance thresholds are breached
        </p>
        {successMsg && (
          <p className="mt-2 text-sm font-medium text-emerald-600">{successMsg}</p>
        )}
        {errorMsg && (
          <p className="mt-2 text-sm font-medium text-destructive">{errorMsg}</p>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Enable Auto-Freeze</CardTitle>
          <CardDescription>
            When enabled, CIP will automatically freeze customer accounts that exceed configured risk thresholds.
            Freeze actions are logged in the audit trail and reported via webhook.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <label className="flex items-center gap-3">
            <div className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                className="peer sr-only"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
              />
              <div className="peer h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-primary peer-checked:after:translate-x-full peer-checked:after:border-white dark:bg-gray-700" />
            </div>
            <span className="font-medium">{enabled ? "Enabled" : "Disabled"}</span>
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>VASP Freeze Endpoint</CardTitle>
          <CardDescription>
            CIP will POST a freeze notification to this URL when auto-freeze triggers.
            Your exchange should handle the freeze on its side.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Endpoint URL</Label>
            <input
              type="url"
              value={vaspEndpoint}
              onChange={(e) => setVaspEndpoint(e.target.value)}
              placeholder="https://exchange.com/api/webhooks/cip-freeze"
              className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            />
          </div>
          <div>
            <Label>Auth Token (masked)</Label>
            <input
              type="password"
              value={authToken}
              onChange={(e) => setAuthToken(e.target.value)}
              placeholder="Bearer xyz..."
              className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            />
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={handleTest} disabled={testing || !vaspEndpoint}>
              {testing ? "Testing..." : "Test Endpoint"}
            </Button>
            {testResult && (
              <span className={`text-sm font-medium ${testResult.delivered ? "text-emerald-600" : "text-destructive"}`}>
                {testResult.delivered
                  ? `Delivered (HTTP ${testResult.statusCode})`
                  : `Failed${testResult.error ? `: ${testResult.error}` : ""}`}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Freeze Thresholds</CardTitle>
          <CardDescription>
            Define the risk score thresholds that trigger automatic account freezing
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label>Wallet Risk Score Threshold (0-100)</Label>
            <input
              type="range"
              min="0"
              max="100"
              value={walletRiskMin}
              onChange={(e) => setWalletRiskMin(Number(e.target.value))}
              className="mt-2 w-full"
            />
            <p className="mt-1 text-sm text-muted-foreground">
              Current: {walletRiskMin} -- Wallets scored at or above this will trigger freeze
            </p>
          </div>
          <div>
            <Label>Screening Match Score Threshold (0-100)</Label>
            <input
              type="range"
              min="0"
              max="100"
              value={screeningMatchMin}
              onChange={(e) => setScreeningMatchMin(Number(e.target.value))}
              className="mt-2 w-full"
            />
            <p className="mt-1 text-sm text-muted-foreground">
              Current: {screeningMatchMin} -- Screening matches at or above this will trigger freeze
            </p>
          </div>
          <div>
            <label className="flex items-center gap-3">
              <div className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={sanctionsTruePositive}
                  onChange={(e) => setSanctionsTruePositive(e.target.checked)}
                />
                <div className="peer h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-primary peer-checked:after:translate-x-full peer-checked:after:border-white dark:bg-gray-700" />
              </div>
              <div>
                <span className="font-medium">Auto-freeze on any sanctions true positive</span>
                <p className="text-sm text-muted-foreground">
                  Immediately freeze when any sanctions screening result is confirmed as true positive
                </p>
              </div>
            </label>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} size="lg">
          {saving ? "Saving..." : "Save Auto-Freeze Settings"}
        </Button>
      </div>
    </div>
  );
}
