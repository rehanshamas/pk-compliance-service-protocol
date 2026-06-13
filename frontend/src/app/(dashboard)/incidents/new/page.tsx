"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/api";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";

const SEVERITY_OPTIONS = [
  { value: "critical", label: "Critical" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

const CATEGORY_OPTIONS = [
  { value: "data_breach", label: "Data Breach" },
  { value: "system_outage", label: "System Outage" },
  { value: "compliance_breach", label: "Compliance Breach" },
  { value: "fraud_detected", label: "Fraud Detected" },
  { value: "unauthorized_access", label: "Unauthorized Access" },
  { value: "aml_cft_failure", label: "AML/CFT Failure" },
  { value: "other", label: "Other" },
];

export default function NewIncidentPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    title: "",
    severity: "",
    category: "",
    description: "",
    detected_at: "",
    affected_systems: "",
    affected_customers_count: "",
    containment_steps: "",
  });

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const canSubmit = form.title.trim() && form.severity && form.category && form.description.trim();

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const body: Record<string, any> = {
        title: form.title.trim(),
        severity: form.severity,
        category: form.category,
        description: form.description.trim(),
      };
      if (form.detected_at) body.detected_at = new Date(form.detected_at).toISOString();
      if (form.affected_systems.trim()) body.affected_systems = form.affected_systems.trim();
      if (form.affected_customers_count) body.affected_customers_count = parseInt(form.affected_customers_count);
      if (form.containment_steps.trim()) body.containment_steps = form.containment_steps.trim();

      const created = await apiRequest<{ id: string }>("/incidents", {
        method: "POST",
        body: JSON.stringify(body),
      });
      toast.success("Incident reported successfully");
      router.push(`/incidents/${created.id}`);
    } catch (e: any) {
      toast.error(e.message || "Failed to report incident");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.push("/incidents")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Incidents
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-semibold">Report New Incident</h1>
        <p className="text-muted-foreground">
          Report a security or compliance incident. PVARA requires authority notification within 1 hour.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Incident Details</CardTitle>
          <CardDescription>Provide initial information about the incident</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              className="mt-1"
              value={form.title}
              onChange={(e) => updateField("title", e.target.value)}
              placeholder="Brief description of the incident"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="severity">Severity *</Label>
              <select
                id="severity"
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={form.severity}
                onChange={(e) => updateField("severity", e.target.value)}
              >
                <option value="">Select severity</option>
                {SEVERITY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="category">Category *</Label>
              <select
                id="category"
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={form.category}
                onChange={(e) => updateField("category", e.target.value)}
              >
                <option value="">Select category</option>
                {CATEGORY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <Label htmlFor="description">Description *</Label>
            <textarea
              id="description"
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              rows={4}
              value={form.description}
              onChange={(e) => updateField("description", e.target.value)}
              placeholder="Detailed description of what happened..."
            />
          </div>

          <div>
            <Label htmlFor="detected_at">Detection Time</Label>
            <Input
              id="detected_at"
              type="datetime-local"
              className="mt-1"
              value={form.detected_at}
              onChange={(e) => updateField("detected_at", e.target.value)}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              When was the incident first detected? Leave blank for current time.
            </p>
          </div>

          <div>
            <Label htmlFor="affected_systems">Affected Systems</Label>
            <textarea
              id="affected_systems"
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              rows={2}
              value={form.affected_systems}
              onChange={(e) => updateField("affected_systems", e.target.value)}
              placeholder="List affected systems, services, or infrastructure..."
            />
          </div>

          <div>
            <Label htmlFor="affected_customers_count">Affected Customers Count</Label>
            <Input
              id="affected_customers_count"
              type="number"
              min={0}
              className="mt-1"
              value={form.affected_customers_count}
              onChange={(e) => updateField("affected_customers_count", e.target.value)}
              placeholder="0"
            />
          </div>

          <div>
            <Label htmlFor="containment_steps">Containment Steps</Label>
            <textarea
              id="containment_steps"
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              rows={3}
              value={form.containment_steps}
              onChange={(e) => updateField("containment_steps", e.target.value)}
              placeholder="Immediate steps taken to contain the incident..."
            />
          </div>

          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={() => router.push("/incidents")}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={submitting || !canSubmit}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Reporting...
                </>
              ) : (
                "Report Incident"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
