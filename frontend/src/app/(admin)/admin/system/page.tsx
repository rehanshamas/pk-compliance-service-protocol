"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getSystemSettings, updateSystemSettings, apiRequest } from "@/lib/api";
import { toast } from "sonner";
import { Loader2, RefreshCw, Database, Server, Globe, Mail, Shield, Radio } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface HealthStatus {
  status: string;
  database?: { status: string; connections?: number; max_connections?: number };
  redis?: { status: string; memory_used?: string };
  uptime?: string;
  version?: string;
  [key: string]: any;
}

interface MetricCard {
  label: string;
  value: string;
  status: "healthy" | "degraded" | "down" | "unknown";
}

interface ComponentHealth {
  status: string;
  latency_ms?: number;
  message?: string;
  details?: Record<string, any>;
  [key: string]: any;
}

interface DetailedHealth {
  status: string;
  components?: Record<string, ComponentHealth>;
  [key: string]: any;
}

const COMPONENT_ICONS: Record<string, React.ReactNode> = {
  postgres: <Database className="h-5 w-5" />,
  redis: <Server className="h-5 w-5" />,
  blockscout: <Globe className="h-5 w-5" />,
  subsquid: <Radio className="h-5 w-5" />,
  nadra: <Shield className="h-5 w-5" />,
  smtp: <Mail className="h-5 w-5" />,
};

const COMPONENT_LABELS: Record<string, string> = {
  postgres: "Postgres",
  redis: "Redis",
  blockscout: "Blockscout",
  subsquid: "Subsquid",
  nadra: "NADRA",
  smtp: "SMTP",
};

function getStatusVariant(status: string): "default" | "destructive" | "secondary" {
  if (status === "healthy" || status === "ok" || status === "up") return "default";
  if (status === "degraded") return "secondary";
  if (status === "down" || status === "error") return "destructive";
  return "secondary";
}

export default function AdminSystemPage() {
  const [metrics, setMetrics] = useState<MetricCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [detailedHealth, setDetailedHealth] = useState<DetailedHealth | null>(null);
  const [detailedLoading, setDetailedLoading] = useState(true);

  // Analytics layer toggles
  const [l1Enabled, setL1Enabled] = useState(true);
  const [l2Enabled, setL2Enabled] = useState(true);
  const [l3Enabled, setL3Enabled] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  // Configuration info
  const [configInfo, setConfigInfo] = useState<Record<string, string>>({});

  const fetchHealth = useCallback(async () => {
    try {
      setLoading(true);
      const token = typeof window !== "undefined" ? localStorage.getItem("cip_access_token") : null;
      const res = await fetch(`${API_BASE}/health/ready`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data: HealthStatus = await res.json();

      const cards: MetricCard[] = [];

      // Overall status
      cards.push({
        label: "API Status",
        value: data.status === "ok" || data.status === "healthy" ? "Operational" : data.status || "Unknown",
        status: data.status === "ok" || data.status === "healthy" ? "healthy" : "degraded",
      });

      // Database
      if (data.database) {
        const dbConns = data.database.connections && data.database.max_connections
          ? `${data.database.connections}/${data.database.max_connections}`
          : data.database.status || "Connected";
        cards.push({
          label: "Postgres",
          value: dbConns,
          status: data.database.status === "ok" || data.database.status === "healthy" ? "healthy" : "degraded",
        });
      }

      // Redis
      if (data.redis) {
        cards.push({
          label: "Redis",
          value: data.redis.memory_used || data.redis.status || "Connected",
          status: data.redis.status === "ok" || data.redis.status === "healthy" ? "healthy" : "degraded",
        });
      }

      // Uptime
      if (data.uptime) {
        cards.push({ label: "Uptime", value: data.uptime, status: "healthy" });
      }

      // Version
      if (data.version) {
        cards.push({ label: "Version", value: data.version, status: "healthy" });
      }

      // Add any other top-level status fields
      for (const [key, val] of Object.entries(data)) {
        if (["status", "database", "redis", "uptime", "version"].includes(key)) continue;
        if (typeof val === "object" && val !== null && "status" in val) {
          cards.push({
            label: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, " "),
            value: (val as any).status || "Unknown",
            status: (val as any).status === "ok" || (val as any).status === "healthy" ? "healthy" : "degraded",
          });
        }
      }

      // If API returned very little, show a basic card
      if (cards.length === 0) {
        cards.push({ label: "API", value: res.ok ? "Reachable" : "Unreachable", status: res.ok ? "healthy" : "down" });
      }

      setMetrics(cards);
    } catch (err: any) {
      setMetrics([
        { label: "API Status", value: "Unreachable", status: "down" },
      ]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDetailedHealth = useCallback(async () => {
    try {
      setDetailedLoading(true);
      const data = await apiRequest<DetailedHealth>("/admin/system/health");
      setDetailedHealth(data);
    } catch {
      // Detailed health endpoint may not be available, fall back silently
      setDetailedHealth(null);
    } finally {
      setDetailedLoading(false);
    }
  }, []);

  const fetchSettings = useCallback(async () => {
    try {
      setSettingsLoading(true);
      const raw = await getSystemSettings("analytics");
      // API returns array of {key, value, ...} — convert to key-value map
      const arr = Array.isArray(raw) ? raw : raw?.data || [];
      const settings: Record<string, string> = {};
      for (const s of arr) {
        if (s?.key) settings[s.key] = s.value ?? "";
      }
      setL1Enabled(settings.analytics_l1_enabled === "true");
      setL2Enabled(settings.analytics_l2_enabled === "true");
      setL3Enabled(settings.analytics_l3_enabled === "true");

      // Also fetch all settings for config info
      const allRaw = await getSystemSettings();
      const allArr = Array.isArray(allRaw) ? allRaw : allRaw?.data || [];
      const allSettings: Record<string, string> = {};
      for (const s of allArr) {
        if (s?.key) allSettings[s.key] = s.value ?? "";
      }
      const config: Record<string, string> = {};
      if (allSettings.environment) config["Environment"] = allSettings.environment;
      if (allSettings.identity_primary_provider) config["Identity Provider"] = allSettings.identity_primary_provider;
      if (allSettings.nadra_adapter_mode) config["NADRA Adapter"] = allSettings.nadra_adapter_mode;
      if (allSettings.subsquid_mode) config["Subsquid Mode"] = allSettings.subsquid_mode;
      if (allSettings.analytics_l3_provider) config["L3 Provider"] = allSettings.analytics_l3_provider;
      if (allSettings.smtp_enabled) config["SMTP Enabled"] = allSettings.smtp_enabled;
      setConfigInfo(config);
    } catch {
      // Settings might not exist yet
    } finally {
      setSettingsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    fetchDetailedHealth();
    fetchSettings();
  }, [fetchHealth, fetchDetailedHealth, fetchSettings]);

  const handleSaveAnalyticsSettings = async () => {
    setSavingSettings(true);
    try {
      await updateSystemSettings({
        analytics_l1_enabled: String(l1Enabled),
        analytics_l2_enabled: String(l2Enabled),
        analytics_l3_enabled: String(l3Enabled),
      });
      toast.success("Analytics settings saved");
    } catch (err: any) {
      toast.error("Failed to save settings: " + (err.message || "Unknown error"));
    } finally {
      setSavingSettings(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">System Health</h1>
          <p className="text-muted-foreground">Platform infrastructure status</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { fetchHealth(); fetchDetailedHealth(); }} disabled={loading || detailedLoading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading || detailedLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {metrics.map((m) => (
            <Card key={m.label}>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-medium">{m.label}</CardTitle>
                <Badge variant={getStatusVariant(m.status)}>{m.status}</Badge>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{m.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Detailed Component Health */}
      {detailedLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Loading component health...</span>
        </div>
      ) : detailedHealth?.components ? (
        <>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">Component Health</h2>
            <Badge variant={getStatusVariant(detailedHealth.status || "unknown")}>
              {detailedHealth.status || "unknown"}
            </Badge>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Object.entries(detailedHealth.components).map(([name, comp]) => {
              const label = COMPONENT_LABELS[name] || name.charAt(0).toUpperCase() + name.slice(1);
              const icon = COMPONENT_ICONS[name] || <Server className="h-5 w-5" />;
              const status = comp.status || "unknown";
              const isHealthy = status === "ok" || status === "healthy" || status === "up";
              return (
                <Card key={name}>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <div className="flex items-center gap-2">
                      <span className={isHealthy ? "text-green-500" : status === "degraded" ? "text-yellow-500" : "text-red-500"}>
                        {icon}
                      </span>
                      <CardTitle className="text-sm font-medium">{label}</CardTitle>
                    </div>
                    <Badge variant={getStatusVariant(status)}>{status}</Badge>
                  </CardHeader>
                  <CardContent className="space-y-1">
                    {comp.latency_ms !== undefined && (
                      <p className="text-sm">
                        <span className="text-muted-foreground">Latency:</span>{" "}
                        <span className="font-medium">{comp.latency_ms}ms</span>
                      </p>
                    )}
                    {comp.message && (
                      <p className="text-sm text-muted-foreground">{comp.message}</p>
                    )}
                    {comp.details && Object.keys(comp.details).length > 0 && (
                      <div className="text-xs text-muted-foreground space-y-0.5 pt-1">
                        {Object.entries(comp.details).map(([k, v]) => (
                          <p key={k}>
                            <span className="capitalize">{k.replace(/_/g, " ")}:</span>{" "}
                            {typeof v === "object" ? JSON.stringify(v) : String(v)}
                          </p>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Analytics Layer Configuration</CardTitle>
          <CardDescription>Enable or disable analytics processing layers</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {settingsLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading settings...
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={l1Enabled}
                    onChange={(e) => setL1Enabled(e.target.checked)}
                    className="h-4 w-4 rounded border-input"
                  />
                  <span>L1 (On-chain basic)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={l2Enabled}
                    onChange={(e) => setL2Enabled(e.target.checked)}
                    className="h-4 w-4 rounded border-input"
                  />
                  <span>L2 (Enriched analytics)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={l3Enabled}
                    onChange={(e) => setL3Enabled(e.target.checked)}
                    className="h-4 w-4 rounded border-input"
                  />
                  <span>L3 (Commercial / Advanced)</span>
                </label>
              </div>
              <Button onClick={handleSaveAnalyticsSettings} disabled={savingSettings} size="sm">
                {savingSettings ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save Analytics Settings
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Service Configuration</CardTitle>
          <CardDescription>Current provider and environment settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {settingsLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading...
            </div>
          ) : Object.keys(configInfo).length > 0 ? (
            Object.entries(configInfo).map(([key, val]) => (
              <p key={key}>
                <span className="text-muted-foreground">{key}:</span> {val}
              </p>
            ))
          ) : (
            <p className="text-muted-foreground">
              No configuration data available. Settings will appear once configured via the system settings API.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
