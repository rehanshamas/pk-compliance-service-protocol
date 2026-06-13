"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const STEPS = [
  { id: 1, label: "Company" },
  { id: 2, label: "Contacts" },
  { id: 3, label: "Features" },
  { id: 4, label: "Review" },
];

const FEATURE_FLAGS = [
  { key: "identity", label: "Identity (KYC/NADRA)" },
  { key: "screening", label: "Sanctions Screening" },
  { key: "analytics", label: "Blockchain Analytics" },
  { key: "compliance", label: "Compliance Operations (Cases, Reports)" },
];

export default function VaspOnboardingPage() {
  const [step, setStep] = useState(1);
  const [companyName, setCompanyName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [address, setAddress] = useState("");
  const [mlroName, setMlroName] = useState("");
  const [mlroEmail, setMlroEmail] = useState("");
  const [complianceEmail, setComplianceEmail] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [features, setFeatures] = useState<Record<string, boolean>>({
    identity: true,
    screening: true,
    analytics: false,
    compliance: true,
  });
  const [created, setCreated] = useState(false);

  const slug = companyName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const handleNext = () => {
    if (step < 4) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleCreate = () => {
    // Mock: "create" tenant — in production would call API
    setCreated(true);
  };

  if (created) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">VASP Onboarded</h1>
          <p className="text-muted-foreground">Tenant created successfully</p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <p className="mb-4">Tenant <strong>{companyName}</strong> has been created with slug <code className="rounded bg-muted px-1">{slug}</code>.</p>
            <p className="mb-4 text-sm text-muted-foreground">
              The MLRO will receive login instructions at {mlroEmail}.
            </p>
            <div className="flex gap-2">
              <Link
                href="/admin/tenants"
                className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                View Tenants
              </Link>
              <Link
                href="/admin/onboarding"
                className="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
              >
                Onboard Another
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">VASP Onboarding</h1>
        <p className="text-muted-foreground">
          Register a new VASP tenant on the platform
        </p>
      </div>
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
          <CardDescription>Complete each section to onboard the VASP</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {step === 1 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Company Name</Label>
                <Input
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g. CryptoExchange PK"
                />
              </div>
              <div>
                <Label>Legal Name</Label>
                <Input
                  value={legalName}
                  onChange={(e) => setLegalName(e.target.value)}
                  placeholder="Full legal entity name"
                />
              </div>
              <div>
                <Label>Registration / License Number</Label>
                <Input
                  value={registrationNumber}
                  onChange={(e) => setRegistrationNumber(e.target.value)}
                  placeholder="SECP / SBP registration"
                />
              </div>
              <div className="sm:col-span-2">
                <Label>Registered Address</Label>
                <Input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Full address"
                />
              </div>
            </div>
          )}
          {step === 2 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>MLRO Name</Label>
                <Input
                  value={mlroName}
                  onChange={(e) => setMlroName(e.target.value)}
                  placeholder="Money Laundering Reporting Officer"
                />
              </div>
              <div>
                <Label>MLRO Email</Label>
                <Input
                  type="email"
                  value={mlroEmail}
                  onChange={(e) => setMlroEmail(e.target.value)}
                  placeholder="mlro@vasp.pk"
                />
              </div>
              <div>
                <Label>Compliance Officer Email</Label>
                <Input
                  type="email"
                  value={complianceEmail}
                  onChange={(e) => setComplianceEmail(e.target.value)}
                  placeholder="compliance@vasp.pk"
                />
              </div>
              <div>
                <Label>Admin Email</Label>
                <Input
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder="admin@vasp.pk"
                />
              </div>
            </div>
          )}
          {step === 3 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Enable feature modules for this tenant</p>
              <div className="flex flex-col gap-3">
                {FEATURE_FLAGS.map((f) => (
                  <label
                    key={f.key}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={features[f.key] ?? false}
                      onChange={(e) =>
                        setFeatures((prev) => ({ ...prev, [f.key]: e.target.checked }))
                      }
                      className="h-4 w-4 rounded border-input"
                    />
                    <span>{f.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          {step === 4 && (
            <div className="space-y-4">
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <p className="text-sm text-muted-foreground">Company</p>
                  <p className="font-medium">{companyName || "—"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Slug</p>
                  <p className="font-mono text-sm">{slug || "—"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">MLRO</p>
                  <p className="font-medium">{mlroName || "—"} &lt;{mlroEmail || "—"}&gt;</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Features</p>
                  <p className="text-sm">
                    {Object.entries(features)
                      .filter(([, v]) => v)
                      .map(([k]) => FEATURE_FLAGS.find((f) => f.key === k)?.label ?? k)
                      .join(", ") || "—"}
                  </p>
                </div>
              </div>
            </div>
          )}
          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={handleBack} disabled={step === 1}>
              Back
            </Button>
            {step < 4 ? (
              <Button onClick={handleNext}>Next</Button>
            ) : (
              <Button onClick={handleCreate}>Create Tenant</Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
