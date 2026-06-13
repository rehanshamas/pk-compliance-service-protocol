"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/api";

const RECORD_TYPES = [
  "Customer identification (KYC) and due diligence",
  "Transaction records and supporting documents",
  "ISARs, STRs, and related case files",
  "Sanctions screening results and dispositions",
  "Training records and policies",
];

export default function SettingsRetentionPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [retentionYears, setRetentionYears] = useState("7");
  const [actionAtExpiry, setActionAtExpiry] = useState<"archive" | "delete">("archive");
  const [notifyDaysBefore, setNotifyDaysBefore] = useState("30");
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const retentionYearsNum = parseInt(retentionYears, 10);
  const isValidYears = !isNaN(retentionYearsNum) && retentionYearsNum >= 7 && retentionYearsNum <= 15;

  useEffect(() => {
    apiRequest<{ feature_flags: Record<string, unknown> }>("/tenants/me/settings")
      .then((res) => {
        const flags = res.feature_flags || {};
        if (typeof flags.retention_years === "number") {
          setRetentionYears(String(flags.retention_years));
        }
        if (typeof flags.auto_delete_expired === "boolean") {
          setActionAtExpiry(flags.auto_delete_expired ? "delete" : "archive");
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const saveRetention = async () => {
    if (!isValidYears) return;
    setSaving("retention");
    try {
      await apiRequest("/tenants/me/settings/retention", {
        method: "PATCH",
        body: JSON.stringify({ retention_years: retentionYearsNum }),
      });
      showSuccess("Retention period saved");
    } catch {}
    setSaving(null);
  };

  const saveExpiry = async () => {
    setSaving("expiry");
    try {
      await apiRequest("/tenants/me/settings/retention", {
        method: "PATCH",
        body: JSON.stringify({ auto_delete_expired: actionAtExpiry === "delete" }),
      });
      showSuccess("Expiry action saved");
    } catch {}
    setSaving(null);
  };

  if (loading) {
    return <div className="p-6 text-muted-foreground">Loading settings...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">
          7-year Record Retention
        </h1>
        <p className="text-muted-foreground">
          Configure AML/CFT record retention policy. Minimum 7 years required under AMLA 2010 and NOC Regulations.
        </p>
        {successMsg && (
          <p className="mt-2 text-sm font-medium text-emerald-600">{successMsg}</p>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Retention period</CardTitle>
          <CardDescription>
            How long to keep records. Regulatory minimum is 7 years. Cannot be reduced below 7.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-w-xs">
            <Label htmlFor="retentionYears">Retention period (years)</Label>
            <Input
              id="retentionYears"
              type="number"
              min={7}
              max={15}
              value={retentionYears}
              onChange={(e) => setRetentionYears(e.target.value)}
              className="mt-2"
            />
            {!isValidYears && retentionYears !== "" && (
              <p className="mt-1 text-sm text-destructive">Must be between 7 and 15 years.</p>
            )}
          </div>
          <Button onClick={saveRetention} disabled={!isValidYears || saving === "retention"}>
            {saving === "retention" ? "Saving..." : "Save"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Action at expiry</CardTitle>
          <CardDescription>
            What happens when the retention period ends. Archive keeps a compressed copy; delete removes records.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>When retention expires</Label>
            <select
              value={actionAtExpiry}
              onChange={(e) => setActionAtExpiry(e.target.value as "archive" | "delete")}
              className="mt-2 h-10 w-full max-w-xs rounded-md border border-input bg-background px-3"
            >
              <option value="archive">Archive (compress and store)</option>
              <option value="delete">Delete (remove records)</option>
            </select>
          </div>
          <Button onClick={saveExpiry} disabled={saving === "expiry"}>
            {saving === "expiry" ? "Saving..." : "Save"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Expiry notifications</CardTitle>
          <CardDescription>
            Receive alerts before records are due to expire. Helps with audits and regulatory checks.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-w-xs">
            <Label htmlFor="notifyDays">Notify (days before expiry)</Label>
            <Input
              id="notifyDays"
              type="number"
              min={0}
              max={365}
              placeholder="0 = disabled"
              value={notifyDaysBefore}
              onChange={(e) => setNotifyDaysBefore(e.target.value)}
              className="mt-2"
            />
          </div>
          <Button disabled>Save</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Record types retained</CardTitle>
          <CardDescription>
            Mandatory record types under AMLA and NOC. All are retained -- no per-type opt-out.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {RECORD_TYPES.map((r) => (
              <li key={r} className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                {r}
              </li>
            ))}
          </ul>
          <Link href="/docs/record-retention" className="mt-4 inline-block text-sm text-primary hover:underline">
            Learn more about 7-year retention →
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
