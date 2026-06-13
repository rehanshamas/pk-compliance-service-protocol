"use client";

import { useEffect, useState, useCallback } from "react";
import { apiRequest } from "@/lib/api";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Settings,
  Shield,
  Bell,
  MessageSquare,
  Eye,
  Server,
  Loader2,
  ChevronDown,
  ChevronRight,
  Wrench,
  Globe,
  BarChart3,
  ShieldCheck,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Toggle Switch                                                      */
/* ------------------------------------------------------------------ */
function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-[24px] w-[44px] shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? "bg-primary" : "bg-muted"
      }`}
    >
      <span
        className={`pointer-events-none block h-[18px] w-[18px] rounded-full bg-background shadow-lg ring-0 transition-transform duration-200 ${
          checked ? "translate-x-[22px]" : "translate-x-[2px]"
        }`}
      />
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface IdentityRouting {
  identity_primary_provider: string;
  identity_fallback_provider: string;
  identity_fallback_trigger: string;
  identity_fallback_timeout_ms: number;
  identity_fallback_confidence_threshold: number;
}

interface Notifications {
  notif_admin_email_enabled: boolean;
  notif_admin_email_on_application: boolean;
  notif_admin_email_on_pipeline_failure: boolean;
  notif_admin_email_on_system_health: boolean;
  notif_tenant_email_alerts_enabled: boolean;
  notif_tenant_webhook_enabled: boolean;
  notif_tenant_daily_digest: boolean;
  notif_smtp_provider: string;
}

interface ChatSettings {
  enabled: boolean;
  welcome_message: string;
}

interface VaspConfig {
  vasp_settings_team_enabled: boolean;
  vasp_settings_api_keys_enabled: boolean;
  vasp_settings_webhooks_enabled: boolean;
  vasp_settings_screening_enabled: boolean;
  vasp_settings_monitoring_enabled: boolean;
  vasp_settings_retention_enabled: boolean;
  vasp_settings_analytics_enabled: boolean;
  vasp_settings_billing_enabled: boolean;
  vasp_settings_api_explorer_enabled: boolean;
}

interface RawSetting {
  key: string;
  value: string;
  is_secret: boolean;
  description: string;
  category: string;
  updated_at: string | null;
}

/* ------------------------------------------------------------------ */
/*  Shared helpers                                                     */
/* ------------------------------------------------------------------ */

function SectionSaving({ saving }: { saving: boolean }) {
  if (!saving) return null;
  return <Loader2 className="h-4 w-4 animate-spin" />;
}

/* ------------------------------------------------------------------ */
/*  Tab 1: Identity Verification                                       */
/* ------------------------------------------------------------------ */

function IdentityTab() {
  const [data, setData] = useState<IdentityRouting | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await apiRequest<IdentityRouting>("/admin/settings/identity-routing");
      setData(res);
    } catch (e: any) {
      toast.error("Failed to load identity settings: " + e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!data) return;
    setSaving(true);
    try {
      await apiRequest("/admin/settings/identity-routing", {
        method: "PATCH",
        body: JSON.stringify(data),
      });
      toast.success("Identity routing settings saved");
    } catch (e: any) {
      toast.error("Save failed: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) return <p className="text-sm text-muted-foreground py-8 text-center">Failed to load settings.</p>;

  const update = <K extends keyof IdentityRouting>(key: K, val: IdentityRouting[K]) =>
    setData((prev) => (prev ? { ...prev, [key]: val } : prev));

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Identity Verification Routing
          </CardTitle>
          <CardDescription>Configure primary and fallback identity verification providers</CardDescription>
        </div>
        <Badge variant="info">KYC</Badge>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Primary Provider */}
        <div className="grid gap-2">
          <Label>Primary Provider</Label>
          <Select value={data.identity_primary_provider} onValueChange={(v) => update("identity_primary_provider", v)}>
            <SelectTrigger>
              <SelectValue placeholder="Select provider" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="nadra">NADRA</SelectItem>
              <SelectItem value="shufti">Shufti Pro</SelectItem>
              <SelectItem value="mock">Mock (Dev)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Fallback Provider */}
        <div className="grid gap-2">
          <Label>Fallback Provider</Label>
          <Select value={data.identity_fallback_provider} onValueChange={(v) => update("identity_fallback_provider", v)}>
            <SelectTrigger>
              <SelectValue placeholder="Select fallback" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="nadra">NADRA</SelectItem>
              <SelectItem value="shufti">Shufti Pro</SelectItem>
              <SelectItem value="mock">Mock (Dev)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Fallback Trigger */}
        <div className="grid gap-2">
          <Label>Fallback Trigger</Label>
          <Select value={data.identity_fallback_trigger} onValueChange={(v) => update("identity_fallback_trigger", v)}>
            <SelectTrigger>
              <SelectValue placeholder="Select trigger" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="timeout">Timeout</SelectItem>
              <SelectItem value="failure">Failure</SelectItem>
              <SelectItem value="low_confidence">Low Confidence</SelectItem>
              <SelectItem value="always">Always</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Timeout */}
        <div className="grid gap-2">
          <Label>Timeout (ms)</Label>
          <Input
            type="number"
            value={data.identity_fallback_timeout_ms}
            onChange={(e) => update("identity_fallback_timeout_ms", Number(e.target.value))}
            placeholder="5000"
          />
        </div>

        {/* Confidence Threshold */}
        <div className="grid gap-2">
          <Label>Confidence Threshold (0-100)</Label>
          <Input
            type="number"
            min={0}
            max={100}
            value={data.identity_fallback_confidence_threshold}
            onChange={(e) => update("identity_fallback_confidence_threshold", Number(e.target.value))}
            placeholder="70"
          />
          <p className="text-xs text-muted-foreground">
            Used when fallback trigger is &quot;low_confidence&quot;
          </p>
        </div>
      </CardContent>
      <CardFooter className="justify-end gap-2">
        <SectionSaving saving={saving} />
        <Button onClick={save} disabled={saving}>
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </CardFooter>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Tab 2: Notifications                                               */
/* ------------------------------------------------------------------ */

function NotificationsTab() {
  const [data, setData] = useState<Notifications | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await apiRequest<Notifications>("/admin/settings/notifications");
      setData(res);
    } catch (e: any) {
      toast.error("Failed to load notification settings: " + e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!data) return;
    setSaving(true);
    try {
      await apiRequest("/admin/settings/notifications", {
        method: "PATCH",
        body: JSON.stringify(data),
      });
      toast.success("Notification settings saved");
    } catch (e: any) {
      toast.error("Save failed: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) return <p className="text-sm text-muted-foreground py-8 text-center">Failed to load settings.</p>;

  const toggle = <K extends keyof Notifications>(key: K) =>
    setData((prev) => (prev ? { ...prev, [key]: !prev[key] } : prev));

  const ToggleRow = ({ label, field }: { label: string; field: keyof Notifications }) => (
    <div className="flex items-center justify-between py-2">
      <Label className="font-normal">{label}</Label>
      <Toggle checked={!!data[field]} onChange={() => toggle(field)} />
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Admin Notifications */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Admin Notifications
            </CardTitle>
            <CardDescription>Email alerts sent to platform administrators</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-1">
          <ToggleRow label="Email notifications enabled" field="notif_admin_email_enabled" />
          <ToggleRow label="Email on new application" field="notif_admin_email_on_application" />
          <ToggleRow label="Email on pipeline failure" field="notif_admin_email_on_pipeline_failure" />
          <ToggleRow label="Email on system health alert" field="notif_admin_email_on_system_health" />
        </CardContent>
      </Card>

      {/* Tenant Notifications */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Tenant Notifications</CardTitle>
            <CardDescription>Notification delivery options for tenant users</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-1">
          <ToggleRow label="Email alerts enabled" field="notif_tenant_email_alerts_enabled" />
          <ToggleRow label="Webhook delivery enabled" field="notif_tenant_webhook_enabled" />
          <ToggleRow label="Daily digest" field="notif_tenant_daily_digest" />
        </CardContent>
      </Card>

      {/* SMTP Provider */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>SMTP Provider</CardTitle>
            <CardDescription>Email delivery service configuration</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <Input
            value={data.notif_smtp_provider}
            onChange={(e) => setData((prev) => prev ? { ...prev, notif_smtp_provider: e.target.value } : prev)}
            placeholder="e.g. ses, sendgrid, mailgun"
          />
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <SectionSaving saving={saving} />
        <Button onClick={save} disabled={saving}>
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Tab 3: Chat Assistant                                              */
/* ------------------------------------------------------------------ */

function ChatTab() {
  const [data, setData] = useState<ChatSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await apiRequest<ChatSettings>("/admin/settings/chat");
      setData(res);
    } catch (e: any) {
      toast.error("Failed to load chat settings: " + e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!data) return;
    setSaving(true);
    try {
      await apiRequest("/admin/settings/chat", {
        method: "PATCH",
        body: JSON.stringify(data),
      });
      toast.success("Chat settings saved");
    } catch (e: any) {
      toast.error("Save failed: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) return <p className="text-sm text-muted-foreground py-8 text-center">Failed to load settings.</p>;

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Chat Assistant
          </CardTitle>
          <CardDescription>Configure the in-app chat assistant for tenant users</CardDescription>
        </div>
        <Badge variant={data.enabled ? "success" : "secondary"}>
          {data.enabled ? "Enabled" : "Disabled"}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Label>Enable Chat Assistant</Label>
            <p className="text-xs text-muted-foreground mt-0.5">Show the chat widget to tenant users</p>
          </div>
          <Toggle
            checked={data.enabled}
            onChange={(v) => setData((prev) => prev ? { ...prev, enabled: v } : prev)}
          />
        </div>

        <div className="grid gap-2">
          <Label>Welcome Message</Label>
          <textarea
            className="flex w-full rounded-md border border-border bg-background/50 px-3 py-2 text-[0.8rem] text-foreground ring-offset-background transition-all duration-150 placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50 min-h-[100px] resize-y"
            value={data.welcome_message}
            onChange={(e) => setData((prev) => prev ? { ...prev, welcome_message: e.target.value } : prev)}
            placeholder="Hello! How can I help you today?"
          />
        </div>
      </CardContent>
      <CardFooter className="justify-end gap-2">
        <SectionSaving saving={saving} />
        <Button onClick={save} disabled={saving}>
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </CardFooter>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Tab 4: VASP Settings                                               */
/* ------------------------------------------------------------------ */

const VASP_LABELS: { key: keyof VaspConfig; label: string }[] = [
  { key: "vasp_settings_team_enabled", label: "Team" },
  { key: "vasp_settings_api_keys_enabled", label: "API Keys" },
  { key: "vasp_settings_webhooks_enabled", label: "Webhooks" },
  { key: "vasp_settings_screening_enabled", label: "Screening Config" },
  { key: "vasp_settings_monitoring_enabled", label: "Monitoring Rules" },
  { key: "vasp_settings_retention_enabled", label: "Record Retention" },
  { key: "vasp_settings_analytics_enabled", label: "Analytics" },
  { key: "vasp_settings_billing_enabled", label: "Usage & Billing" },
  { key: "vasp_settings_api_explorer_enabled", label: "API Explorer" },
];

function VaspTab() {
  const [data, setData] = useState<VaspConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await apiRequest<VaspConfig>("/admin/settings/vasp-config");
      setData(res);
    } catch (e: any) {
      toast.error("Failed to load VASP config: " + e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!data) return;
    setSaving(true);
    try {
      await apiRequest("/admin/settings/vasp-config", {
        method: "PATCH",
        body: JSON.stringify(data),
      });
      toast.success("VASP configuration saved");
    } catch (e: any) {
      toast.error("Save failed: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) return <p className="text-sm text-muted-foreground py-8 text-center">Failed to load settings.</p>;

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-4 w-4" />
            VASP Settings Visibility
          </CardTitle>
          <CardDescription>Control which settings sections are visible to tenant users</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-1">
        {VASP_LABELS.map(({ key, label }) => (
          <div key={key} className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
            <Label className="font-normal">{label}</Label>
            <Toggle
              checked={!!data[key]}
              onChange={(v) => setData((prev) => prev ? { ...prev, [key]: v } : prev)}
            />
          </div>
        ))}
      </CardContent>
      <CardFooter className="justify-end gap-2">
        <SectionSaving saving={saving} />
        <Button onClick={save} disabled={saving}>
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </CardFooter>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Tab 5: Service Configuration                                       */
/* ------------------------------------------------------------------ */

function ServiceConfigTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Platform
  const [platformName, setPlatformName] = useState("");
  const [currency, setCurrency] = useState("PKR");
  // Compliance
  const [ctrThreshold, setCtrThreshold] = useState("500000");
  const [sanctionsEnabled, setSanctionsEnabled] = useState(true);
  const [pepEnabled, setPepEnabled] = useState(true);
  // Analytics
  const [l1Enabled, setL1Enabled] = useState(true);
  const [l2Enabled, setL2Enabled] = useState(true);
  const [l3Enabled, setL3Enabled] = useState(false);
  const [l3Provider, setL3Provider] = useState("mock");
  const [subsquidMode, setSubsquidMode] = useState("public");

  const load = useCallback(async () => {
    try {
      const raw = await apiRequest<RawSetting[] | { data: RawSetting[] }>("/admin/settings");
      const arr = Array.isArray(raw) ? raw : (raw as any)?.data || [];
      const m: Record<string, string> = {};
      for (const s of arr) if (s?.key) m[s.key] = s.value ?? "";

      setPlatformName(m.platform_name || "");
      setCurrency(m.default_currency || "PKR");
      setCtrThreshold(m.ctr_threshold_amount || "500000");
      setSanctionsEnabled(m.sanctions_screening_enabled === "true");
      setPepEnabled(m.pep_screening_enabled === "true");
      setL1Enabled(m.analytics_l1_enabled !== "false");
      setL2Enabled(m.analytics_l2_enabled !== "false");
      setL3Enabled(m.analytics_l3_enabled === "true");
      setL3Provider(m.analytics_l3_provider || "mock");
      setSubsquidMode(m.subsquid_mode || "public");
    } catch (e: any) {
      toast.error("Failed to load service config: " + e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      await apiRequest("/admin/settings", {
        method: "PATCH",
        body: JSON.stringify({
          platform_name: platformName,
          default_currency: currency,
          ctr_threshold_amount: ctrThreshold,
          sanctions_screening_enabled: String(sanctionsEnabled),
          pep_screening_enabled: String(pepEnabled),
          analytics_l1_enabled: String(l1Enabled),
          analytics_l2_enabled: String(l2Enabled),
          analytics_l3_enabled: String(l3Enabled),
          analytics_l3_provider: l3Provider,
          subsquid_mode: subsquidMode,
        }),
      });
      toast.success("Service configuration saved");
    } catch (e: any) {
      toast.error("Save failed: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Platform */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-blue-500" />
              Platform
            </CardTitle>
            <CardDescription>Core platform identity and regional defaults</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label>Platform Name</Label>
            <Input
              value={platformName}
              onChange={(e) => setPlatformName(e.target.value)}
              placeholder="CIP - Compliance Intelligence Platform"
            />
            <p className="text-xs text-muted-foreground">Display name shown across the platform UI</p>
          </div>
          <div className="grid gap-2">
            <Label>Default Currency</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger><SelectValue placeholder="Select currency" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="PKR">PKR - Pakistani Rupee</SelectItem>
                <SelectItem value="USD">USD - US Dollar</SelectItem>
                <SelectItem value="AED">AED - UAE Dirham</SelectItem>
                <SelectItem value="GBP">GBP - British Pound</SelectItem>
                <SelectItem value="EUR">EUR - Euro</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Used for thresholds and reporting</p>
          </div>
        </CardContent>
      </Card>

      {/* Compliance */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              Compliance
            </CardTitle>
            <CardDescription>Screening toggles and regulatory reporting thresholds</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-0 divide-y divide-border">
          <div className="pb-5">
            <div className="grid gap-2">
              <Label>CTR Threshold Amount ({currency})</Label>
              <Input
                type="number"
                value={ctrThreshold}
                onChange={(e) => setCtrThreshold(e.target.value)}
                placeholder="2000000"
              />
              <p className="text-xs text-muted-foreground">
                Transactions at or above this amount trigger a Currency Transaction Report (CTR)
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between py-4">
            <div>
              <Label className="font-normal">Sanctions Screening</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Screen customers against UN, OFAC, EU, and NACTA watchlists</p>
            </div>
            <Toggle checked={sanctionsEnabled} onChange={setSanctionsEnabled} />
          </div>
          <div className="flex items-center justify-between py-4">
            <div>
              <Label className="font-normal">PEP Screening</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Detect Politically Exposed Persons during onboarding</p>
            </div>
            <Toggle checked={pepEnabled} onChange={setPepEnabled} />
          </div>
        </CardContent>
      </Card>

      {/* Analytics */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-violet-500" />
              Analytics Layers
            </CardTitle>
            <CardDescription>Enable or disable blockchain analytics tiers and configure providers</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-0 divide-y divide-border">
          <div className="flex items-center justify-between py-4 first:pt-0">
            <div>
              <Label className="font-normal">Layer 1 -- On-chain Basic</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Direct Blockscout queries (free tier)</p>
            </div>
            <Toggle checked={l1Enabled} onChange={setL1Enabled} />
          </div>
          <div className="flex items-center justify-between py-4">
            <div>
              <Label className="font-normal">Layer 2 -- Enriched Analytics</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Subsquid-indexed on-chain data</p>
            </div>
            <Toggle checked={l2Enabled} onChange={setL2Enabled} />
          </div>
          <div className="flex items-center justify-between py-4">
            <div>
              <Label className="font-normal">Layer 3 -- Commercial / Risk Scoring</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Premium third-party analytics provider</p>
            </div>
            <Toggle checked={l3Enabled} onChange={setL3Enabled} />
          </div>

          <div className="grid gap-5 pt-5 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>L3 Provider</Label>
              <Select value={l3Provider} onValueChange={setL3Provider}>
                <SelectTrigger><SelectValue placeholder="Select provider" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mock">Mock (Dev)</SelectItem>
                  <SelectItem value="scorechain">Scorechain</SelectItem>
                  <SelectItem value="trm">TRM Labs</SelectItem>
                  <SelectItem value="chainalysis">Chainalysis</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Commercial risk-scoring provider for L3</p>
            </div>

            <div className="grid gap-2">
              <Label>Subsquid Mode</Label>
              <Select value={subsquidMode} onValueChange={setSubsquidMode}>
                <SelectTrigger><SelectValue placeholder="Select mode" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">Public Gateway</SelectItem>
                  <SelectItem value="cloud">Cloud (Dedicated)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Subsquid deployment mode for L2 indexing</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2 pt-2">
        <SectionSaving saving={saving} />
        <Button onClick={save} disabled={saving} size="lg">
          {saving ? "Saving..." : "Save Configuration"}
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Tab 6: Advanced (Raw System Settings)                              */
/* ------------------------------------------------------------------ */

const ADVANCED_CATEGORIES: { key: string; label: string }[] = [
  { key: "platform", label: "Platform" },
  { key: "compliance", label: "Compliance" },
  { key: "smtp", label: "Email (SMTP)" },
  { key: "analytics", label: "Analytics" },
  { key: "subsquid", label: "Subsquid Chain Indexer" },
  { key: "sanctions", label: "OpenSanctions" },
  { key: "billing", label: "Billing Defaults" },
];

function AdvancedTab() {
  const [groups, setGroups] = useState<Record<string, RawSetting[]>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    try {
      const results: Record<string, RawSetting[]> = {};
      await Promise.all(
        ADVANCED_CATEGORIES.map(async ({ key }) => {
          try {
            const res = await apiRequest<RawSetting[]>(`/admin/settings?category=${key}`);
            results[key] = Array.isArray(res) ? res : [];
          } catch {
            results[key] = [];
          }
        })
      );
      setGroups(results);
      // expand first non-empty category
      const firstNonEmpty = ADVANCED_CATEGORIES.find(({ key }) => (results[key]?.length ?? 0) > 0);
      if (firstNonEmpty) setExpanded({ [firstNonEmpty.key]: true });
    } catch (e: any) {
      toast.error("Failed to load settings: " + e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (Object.keys(editing).length === 0) return;
    setSaving(true);
    try {
      await apiRequest("/admin/settings", {
        method: "PATCH",
        body: JSON.stringify(editing),
      });
      toast.success(`Saved ${Object.keys(editing).length} setting(s)`);
      setEditing({});
      load();
    } catch (e: any) {
      toast.error("Save failed: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleExpand = (cat: string) =>
    setExpanded((prev) => ({ ...prev, [cat]: !prev[cat] }));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const changedCount = Object.keys(editing).length;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-4 w-4" />
              Raw System Settings
            </CardTitle>
            <CardDescription>
              Advanced configuration values grouped by category. Changes take effect immediately on save.
            </CardDescription>
          </div>
          {changedCount > 0 && (
            <Badge variant="warning">{changedCount} unsaved</Badge>
          )}
        </CardHeader>
      </Card>

      {ADVANCED_CATEGORIES.map(({ key, label }) => {
        const settings = groups[key] || [];
        if (settings.length === 0) return null;
        const isExpanded = !!expanded[key];

        return (
          <Card key={key}>
            <CardHeader
              className="cursor-pointer select-none"
              onClick={() => toggleExpand(key)}
            >
              <div className="flex items-center gap-2">
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
                <CardTitle>{label}</CardTitle>
                <Badge variant="secondary">{settings.length}</Badge>
              </div>
            </CardHeader>
            {isExpanded && (
              <CardContent className="space-y-4">
                {settings.map((s) => (
                  <div key={s.key} className="grid gap-1.5">
                    <div className="flex items-center gap-2">
                      <Label className="font-mono text-xs">{s.key}</Label>
                      {s.is_secret && <Badge variant="warning">secret</Badge>}
                    </div>
                    {s.description && (
                      <p className="text-xs text-muted-foreground">{s.description}</p>
                    )}
                    <Input
                      type={s.is_secret ? "password" : "text"}
                      placeholder={s.is_secret ? "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" : "Not set"}
                      defaultValue={s.is_secret ? "" : s.value}
                      onChange={(e) =>
                        setEditing((prev) => ({ ...prev, [s.key]: e.target.value }))
                      }
                    />
                    {s.updated_at && (
                      <p className="text-[0.65rem] text-muted-foreground/60">
                        Last updated: {new Date(s.updated_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                ))}
              </CardContent>
            )}
          </Card>
        );
      })}

      {changedCount > 0 && (
        <div className="flex justify-end gap-2">
          <SectionSaving saving={saving} />
          <Button variant="outline" onClick={() => setEditing({})} disabled={saving}>
            Discard
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving..." : `Save ${changedCount} Change${changedCount > 1 ? "s" : ""}`}
          </Button>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */

export default function AdminSettingsPage() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Settings className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-semibold">Platform Settings</h1>
      </div>

      <Tabs defaultValue="identity">
        <TabsList className="w-full justify-start gap-1 flex-wrap h-auto p-1">
          <TabsTrigger value="identity" className="gap-1.5">
            <Shield className="h-3.5 w-3.5" />
            Identity
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-1.5">
            <Bell className="h-3.5 w-3.5" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="chat" className="gap-1.5">
            <MessageSquare className="h-3.5 w-3.5" />
            Chat
          </TabsTrigger>
          <TabsTrigger value="vasp" className="gap-1.5">
            <Eye className="h-3.5 w-3.5" />
            VASP Settings
          </TabsTrigger>
          <TabsTrigger value="service" className="gap-1.5">
            <Wrench className="h-3.5 w-3.5" />
            Service Config
          </TabsTrigger>
          <TabsTrigger value="advanced" className="gap-1.5">
            <Settings className="h-3.5 w-3.5" />
            Advanced
          </TabsTrigger>
        </TabsList>

        <TabsContent value="identity">
          <IdentityTab />
        </TabsContent>

        <TabsContent value="notifications">
          <NotificationsTab />
        </TabsContent>

        <TabsContent value="chat">
          <ChatTab />
        </TabsContent>

        <TabsContent value="vasp">
          <VaspTab />
        </TabsContent>

        <TabsContent value="service">
          <ServiceConfigTab />
        </TabsContent>

        <TabsContent value="advanced">
          <AdvancedTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
