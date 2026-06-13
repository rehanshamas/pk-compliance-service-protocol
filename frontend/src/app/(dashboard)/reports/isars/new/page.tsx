"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { HelpTooltip } from "@/components/compliance/help-tooltip";
import { UsageGuide } from "@/components/compliance/usage-guide";
import { apiRequest } from "@/lib/api";

interface Customer {
  id: string;
  full_name?: string;
  fullName?: string;
}

const STEPS = [
  { id: 1, label: "Subject" },
  { id: 2, label: "Suspicion" },
  { id: 3, label: "Evidence" },
  { id: 4, label: "Review" },
];

export default function IsarNewPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [subject, setSubject] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [suspicionType, setSuspicionType] = useState("");
  const [narrative, setNarrative] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Real customers from API
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(true);

  useEffect(() => {
    async function loadCustomers() {
      try {
        const res = await apiRequest<Customer[] | { items: Customer[] }>("/customers?per_page=100");
        const list = Array.isArray(res) ? res : (res as any).items ?? [];
        setCustomers(list);
      } catch {
        // Silently fail — user can still type manually
      } finally {
        setLoadingCustomers(false);
      }
    }
    loadCustomers();
  }, []);

  const handleNext = async () => {
    if (step < 4) {
      setStep(step + 1);
    } else {
      // Submit ISAR via API
      setSubmitting(true);
      try {
        const body: Record<string, any> = {
          subject_name: subject,
          suspicion_type: suspicionType,
          narrative,
        };
        if (customerId) body.customer_id = customerId;

        const created = await apiRequest<{ id: string }>("/isars", {
          method: "POST",
          body: JSON.stringify(body),
        });
        router.push(`/reports/isars/${created.id}`);
      } catch (e: any) {
        alert(e.message || "Failed to create ISAR");
      } finally {
        setSubmitting(false);
      }
    }
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          Create ISAR
          <HelpTooltip term="ISAR" />
        </h1>
        <p className="text-muted-foreground">Internal Suspicious Activity Report (Form A7)</p>
      </div>
      <UsageGuide
        title="How to create an ISAR"
        steps={[
          "Select or enter the subject (person or entity under suspicion).",
          "Choose suspicion type and describe the activity in the narrative.",
          "Link supporting evidence: screening results, analytics, documents.",
          "Review all fields and submit. MLRO will review before STR filing.",
        ]}
      />
      <div className="flex gap-2">
        {STEPS.map((s) => (
          <div
            key={s.id}
            className={`rounded-md px-3 py-1 text-sm ${
              s.id === step
                ? "bg-primary text-primary-foreground"
                : s.id < step
                  ? "bg-muted text-muted-foreground"
                  : "bg-muted/50 text-muted-foreground"
            }`}
          >
            {s.id}. {s.label}
          </div>
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Step {step}: {STEPS[step - 1]?.label}</CardTitle>
          <CardDescription>Complete each section to create the ISAR</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {step === 1 && (
            <>
              <div>
                <Label>Select Customer (or enter manually)</Label>
                <select
                  className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3"
                  value={customerId}
                  onChange={(e) => {
                    setCustomerId(e.target.value);
                    const c = customers.find((x) => x.id === e.target.value);
                    if (c) setSubject(c.full_name ?? c.fullName ?? "");
                  }}
                >
                  <option value="">{loadingCustomers ? "Loading customers..." : "— Select customer —"}</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.full_name ?? c.fullName ?? c.id}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Subject Name</Label>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Full name of subject"
                />
              </div>
            </>
          )}
          {step === 2 && (
            <>
              <div>
                <Label>Suspicion Type</Label>
                <select
                  className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3"
                  value={suspicionType}
                  onChange={(e) => setSuspicionType(e.target.value)}
                >
                  <option value="">— Select —</option>
                  <option value="Structuring">Structuring</option>
                  <option value="Hawala">Hawala</option>
                  <option value="Sanctions match">Sanctions match</option>
                  <option value="Fraud">Fraud</option>
                </select>
              </div>
              <div>
                <Label>Narrative</Label>
                <textarea
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  rows={5}
                  value={narrative}
                  onChange={(e) => setNarrative(e.target.value)}
                  placeholder="Describe the suspicious activity..."
                />
              </div>
            </>
          )}
          {step === 3 && (
            <p className="text-muted-foreground">
              Link screening results, analytics, documents. In production, select from existing records.
            </p>
          )}
          {step === 4 && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Subject</p>
                <p className="font-medium">{subject || "—"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Suspicion Type</p>
                <p className="font-medium">{suspicionType || "—"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Narrative</p>
                <p className="text-sm">{narrative || "—"}</p>
              </div>
            </div>
          )}
          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={handleBack} disabled={step === 1}>
              Back
            </Button>
            <Button onClick={handleNext} disabled={submitting}>
              {step === 4 ? (submitting ? "Submitting..." : "Submit") : "Next"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
