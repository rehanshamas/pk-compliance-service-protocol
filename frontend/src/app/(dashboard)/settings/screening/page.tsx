"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/api";

const SOURCES = ["UN", "OFAC", "EU", "NACTA", "PEP"];

export default function SettingsScreeningPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [fuzzyThreshold, setFuzzyThreshold] = useState(75);
  const [sourcesEnabled, setSourcesEnabled] = useState<Record<string, boolean>>(
    Object.fromEntries(SOURCES.map((s) => [s, true]))
  );
  const [ongoingMonitoring, setOngoingMonitoring] = useState(true);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    apiRequest<{ feature_flags: Record<string, unknown> }>("/tenants/me/settings")
      .then((res) => {
        const flags = res.feature_flags || {};
        if (typeof flags.screening_fuzzy_threshold === "number") {
          setFuzzyThreshold(flags.screening_fuzzy_threshold as number);
        }
        if (flags.screening_sources && typeof flags.screening_sources === "object") {
          setSourcesEnabled((prev) => ({ ...prev, ...(flags.screening_sources as Record<string, boolean>) }));
        }
        if (typeof flags.ongoing_monitoring_enabled === "boolean") {
          setOngoingMonitoring(flags.ongoing_monitoring_enabled as boolean);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const saveThreshold = async () => {
    setSaving("threshold");
    try {
      await apiRequest("/tenants/me/settings/screening", {
        method: "PATCH",
        body: JSON.stringify({ fuzzy_threshold: fuzzyThreshold }),
      });
      showSuccess("Threshold saved");
    } catch {}
    setSaving(null);
  };

  const saveSources = async () => {
    setSaving("sources");
    try {
      await apiRequest("/tenants/me/settings/screening", {
        method: "PATCH",
        body: JSON.stringify({ sources_enabled: sourcesEnabled }),
      });
      showSuccess("Sources saved");
    } catch {}
    setSaving(null);
  };

  const saveMonitoring = async () => {
    setSaving("monitoring");
    try {
      await apiRequest("/tenants/me/settings/screening", {
        method: "PATCH",
        body: JSON.stringify({ ongoing_monitoring_enabled: ongoingMonitoring }),
      });
      showSuccess("Monitoring settings saved");
    } catch {}
    setSaving(null);
  };

  if (loading) {
    return <div className="p-6 text-muted-foreground">Loading settings...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Screening Config</h1>
        <p className="text-muted-foreground">Matching sensitivity and list sources</p>
        {successMsg && (
          <p className="mt-2 text-sm font-medium text-emerald-600">{successMsg}</p>
        )}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Matching Sensitivity</CardTitle>
          <CardDescription>
            Lower = stricter (fewer matches). Higher = more permissive.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Fuzzy threshold (60-100)</Label>
            <input
              type="range"
              min="60"
              max="100"
              value={fuzzyThreshold}
              onChange={(e) => setFuzzyThreshold(Number(e.target.value))}
              className="mt-2 w-full"
            />
            <p className="mt-1 text-sm text-muted-foreground">Current: {fuzzyThreshold}</p>
          </div>
          <Button onClick={saveThreshold} disabled={saving === "threshold"}>
            {saving === "threshold" ? "Saving..." : "Save"}
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>List Sources</CardTitle>
          <CardDescription>Enable or disable screening sources</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {SOURCES.map((s) => (
            <label key={s} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={sourcesEnabled[s] ?? true}
                onChange={(e) =>
                  setSourcesEnabled((prev) => ({ ...prev, [s]: e.target.checked }))
                }
              />
              <span>{s}</span>
            </label>
          ))}
          <Button className="mt-4" onClick={saveSources} disabled={saving === "sources"}>
            {saving === "sources" ? "Saving..." : "Save"}
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Ongoing Monitoring</CardTitle>
          <CardDescription>Re-screen customers when lists update</CardDescription>
        </CardHeader>
        <CardContent>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={ongoingMonitoring}
              onChange={(e) => setOngoingMonitoring(e.target.checked)}
            />
            <span>Enable ongoing monitoring</span>
          </label>
          <Button className="mt-4" onClick={saveMonitoring} disabled={saving === "monitoring"}>
            {saving === "monitoring" ? "Saving..." : "Save"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
