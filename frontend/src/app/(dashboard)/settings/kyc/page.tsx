"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api";

export default function SettingsKycPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [livenessRequired, setLivenessRequired] = useState(false);

  useEffect(() => {
    apiRequest<{ feature_flags: Record<string, unknown> }>("/tenants/me/settings")
      .then((res) => {
        const flags = res.feature_flags || {};
        if (typeof flags.liveness_required === "boolean") {
          setLivenessRequired(flags.liveness_required as boolean);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setErrorMsg(null);
    try {
      await apiRequest("/tenants/me/settings/kyc", {
        method: "PATCH",
        body: JSON.stringify({ liveness_required: livenessRequired }),
      });
      setSuccessMsg("KYC settings saved");
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
        <h1 className="text-2xl font-semibold">KYC Settings</h1>
        <p className="text-muted-foreground">
          Configure identity verification requirements for customer onboarding
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
          <CardTitle>Liveness Verification</CardTitle>
          <CardDescription>
            Control whether customers are required to complete a live camera check during the KYC process.
            When enabled, a liveness step is added between document verification and completion.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <label className="flex items-start gap-3">
            <div className="relative inline-flex cursor-pointer items-center mt-0.5">
              <input
                type="checkbox"
                className="peer sr-only"
                checked={livenessRequired}
                onChange={(e) => setLivenessRequired(e.target.checked)}
              />
              <div className="peer h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-primary peer-checked:after:translate-x-full peer-checked:after:border-white dark:bg-gray-700" />
            </div>
            <div>
              <span className="font-medium">Require liveness verification</span>
              <p className="text-sm text-muted-foreground mt-1">
                When enabled, customers must complete a live camera check during KYC.
                This adds a biometric liveness step after document verification to prevent
                spoofing and ensure the person is physically present.
              </p>
            </div>
          </label>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} size="lg">
          {saving ? "Saving..." : "Save KYC Settings"}
        </Button>
      </div>
    </div>
  );
}
