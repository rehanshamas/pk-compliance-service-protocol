"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/api";

const DEPTH_OPTIONS = [
  { value: "layer_1", label: "Layer 1 only (Blockscout)" },
  { value: "layer_2", label: "Layer 1 + 2 (Blockscout + Subsquid)" },
  { value: "layer_3", label: "Full (Layer 1 + 2 + 3 Commercial)" },
];

export default function SettingsAnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [layer1Enabled, setLayer1Enabled] = useState(true);
  const [layer2Enabled, setLayer2Enabled] = useState(true);
  const [layer3Enabled, setLayer3Enabled] = useState(false);
  const [defaultDepth, setDefaultDepth] = useState("layer_2");

  useEffect(() => {
    apiRequest<{ feature_flags: Record<string, unknown> }>("/tenants/me/settings")
      .then((res) => {
        const flags = res.feature_flags || {};
        if (typeof flags.analytics_layer1_enabled === "boolean") {
          setLayer1Enabled(flags.analytics_layer1_enabled as boolean);
        }
        if (typeof flags.analytics_layer2_enabled === "boolean") {
          setLayer2Enabled(flags.analytics_layer2_enabled as boolean);
        }
        if (typeof flags.analytics_layer3_enabled === "boolean") {
          setLayer3Enabled(flags.analytics_layer3_enabled as boolean);
        }
        if (typeof flags.analytics_default_depth === "string") {
          setDefaultDepth(flags.analytics_default_depth as string);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setErrorMsg(null);
    try {
      await apiRequest("/tenants/me/settings/analytics", {
        method: "PATCH",
        body: JSON.stringify({
          analytics_layer1_enabled: layer1Enabled,
          analytics_layer2_enabled: layer2Enabled,
          analytics_layer3_enabled: layer3Enabled,
          analytics_default_depth: defaultDepth,
        }),
      });
      setSuccessMsg("Analytics settings saved");
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Failed to save");
    }
    setSaving(false);
  };

  if (loading) {
    return <div className="p-6 text-muted-foreground">Loading settings...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Analytics Configuration</h1>
        <p className="text-muted-foreground">
          Control which on-chain analysis layers are used for wallet risk scoring
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
          <CardTitle>Resolution Layers</CardTitle>
          <CardDescription>
            Enable or disable individual data layers. Each layer adds depth to wallet analysis
            but may increase latency and cost.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-start justify-between rounded-lg border p-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">Layer 1 -- Blockscout</span>
                  <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                    Free
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  On-chain address data, transaction history, counterparty analysis via Blockscout explorer API.
                </p>
              </div>
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={layer1Enabled}
                  onChange={(e) => setLayer1Enabled(e.target.checked)}
                />
                <div className="peer h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-primary peer-checked:after:translate-x-full peer-checked:after:border-white dark:bg-gray-700" />
              </label>
            </div>

            <div className="flex items-start justify-between rounded-lg border p-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">Layer 2 -- Subsquid</span>
                  <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                    Included
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Extended transaction indexing via Subsquid. Provides deeper counterparty discovery
                  when Layer 1 data is insufficient.
                </p>
              </div>
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={layer2Enabled}
                  onChange={(e) => setLayer2Enabled(e.target.checked)}
                />
                <div className="peer h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-primary peer-checked:after:translate-x-full peer-checked:after:border-white dark:bg-gray-700" />
              </label>
            </div>

            <div className="flex items-start justify-between rounded-lg border p-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">Layer 3 -- Commercial</span>
                  <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                    Premium
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Commercial-grade risk intelligence. Provides highest confidence scores using
                  proprietary clustering and attribution data.
                </p>
                {!layer3Enabled && (
                  <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                    Requires admin activation. Contact your platform administrator to enable commercial API keys.
                  </p>
                )}
              </div>
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={layer3Enabled}
                  onChange={(e) => setLayer3Enabled(e.target.checked)}
                />
                <div className="peer h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-primary peer-checked:after:translate-x-full peer-checked:after:border-white dark:bg-gray-700" />
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Default Scan Depth</CardTitle>
          <CardDescription>
            Choose the default analysis depth when scoring wallets. Users can override per-check.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-w-md">
            <Label>Default depth</Label>
            <select
              value={defaultDepth}
              onChange={(e) => setDefaultDepth(e.target.value)}
              className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {DEPTH_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} size="lg">
          {saving ? "Saving..." : "Save Analytics Settings"}
        </Button>
      </div>
    </div>
  );
}
