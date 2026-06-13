"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import dynamic from "next/dynamic";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PublicShell } from "@/components/public-shell";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";

const STEPS = [
  { id: 1, label: "Company" },
  { id: 2, label: "Contacts" },
  { id: 3, label: "Regulatory" },
  { id: 4, label: "Review" },
];

const step1Schema = z.object({
  companyName: z.string().min(1, "Company name is required"),
  legalName: z.string().min(1, "Legal name is required"),
  registrationNumber: z.string().optional(),
  address: z.string().min(1, "Address is required"),
});

const step2Schema = z.object({
  mlroName: z.string().min(1, "MLRO name is required"),
  mlroEmail: z.string().min(1, "MLRO email is required").email("Enter a valid email"),
  complianceEmail: z.string().refine((v) => !v?.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()), "Enter a valid email"),
  adminEmail: z.string().refine((v) => !v?.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()), "Enter a valid email"),
});

const step3Schema = z.object({
  nocStatus: z.string().min(1, "Please select NOC status"),
  licenseType: z.string().min(1, "Please select license type"),
});

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function ApplyFormInner() {
  const [step, setStep] = useState(1);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const step1Form = useForm<z.infer<typeof step1Schema>>({
    resolver: zodResolver(step1Schema),
    mode: "onBlur",
    defaultValues: { companyName: "", legalName: "", registrationNumber: "", address: "" },
  });

  const step2Form = useForm<z.infer<typeof step2Schema>>({
    resolver: zodResolver(step2Schema),
    mode: "onBlur",
    defaultValues: { mlroName: "", mlroEmail: "", complianceEmail: "", adminEmail: "" },
  });

  const step3Form = useForm<z.infer<typeof step3Schema>>({
    resolver: zodResolver(step3Schema),
    mode: "onBlur",
    defaultValues: { nocStatus: "", licenseType: "" },
  });

  const companyName = step1Form.watch("companyName");
  const legalName = step1Form.watch("legalName");
  const registrationNumber = step1Form.watch("registrationNumber");
  const address = step1Form.watch("address");
  const mlroName = step2Form.watch("mlroName");
  const mlroEmail = step2Form.watch("mlroEmail");
  const complianceEmail = step2Form.watch("complianceEmail");
  const adminEmail = step2Form.watch("adminEmail");
  const nocStatus = step3Form.watch("nocStatus");
  const licenseType = step3Form.watch("licenseType");

  const handleNext = async () => {
    if (step === 1) {
      const ok = await step1Form.trigger();
      if (ok) setStep(2);
    } else if (step === 2) {
      const ok = await step2Form.trigger();
      if (ok) setStep(3);
    } else if (step === 3) {
      const ok = await step3Form.trigger();
      if (ok) setStep(4);
    }
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitError(null);
    const data = {
      company_name: companyName,
      legal_name: legalName,
      registration_number: registrationNumber,
      address,
      mlro_name: mlroName,
      mlro_email: mlroEmail,
      compliance_email: complianceEmail,
      admin_email: adminEmail,
      noc_status: nocStatus,
      license_type: licenseType,
    };
    try {
      const res = await fetch(`${API_BASE}/api/v1/applications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error?.message || body.detail || res.statusText);
      }
      setSubmitted(true);
      toast.success("Application submitted successfully. We'll be in touch within 2-3 business days.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to submit application";
      setSubmitError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <PublicShell>
        <div className="container max-w-xl mx-auto py-20 px-6 flex-1">
          <Card>
            <CardHeader>
              <CardTitle>Application received</CardTitle>
              <CardDescription>
                Thank you for applying to CIP. We will review your application
                and be in touch within 2-3 business days at {mlroEmail}.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                You will receive login credentials once your application is
                approved.
              </p>
              <div className="flex gap-2">
                <Link href="/">
                  <Button variant="outline">Back to home</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </PublicShell>
    );
  }

  return (
    <PublicShell>
      <div className="container max-w-2xl mx-auto py-16 pt-24 px-6">
        <Link
          href="/"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-8"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to home
        </Link>

        <div className="mb-8">
          <h1 className="text-2xl font-semibold">Apply for CIP</h1>
          <p className="text-muted-foreground">
            Complete the form below. We will review your application and
            contact you within 2-3 business days.
          </p>
        </div>

        <div className="flex gap-2 mb-6">
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

        <Card className="card-green-top">
          <CardHeader>
            <CardTitle>Step {step}: {STEPS[step - 1]?.label}</CardTitle>
            <CardDescription>
              {step === 1 && "Your company or VASP details"}
              {step === 2 && "Key contacts for compliance and access"}
              {step === 3 && "Regulatory status (NOC, license type)"}
              {step === 4 && "Review before submitting"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {step === 1 && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="companyName">Company Name</Label>
                  <Input
                    id="companyName"
                    placeholder="e.g. CryptoExchange PK"
                    className={`fi-green ${step1Form.formState.errors.companyName ? "border-destructive" : ""}`}
                    {...step1Form.register("companyName")}
                  />
                  {step1Form.formState.errors.companyName && (
                    <p className="text-xs text-destructive">{step1Form.formState.errors.companyName.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="legalName">Legal Name</Label>
                  <Input
                    id="legalName"
                    placeholder="Full legal entity name"
                    className={`fi-green ${step1Form.formState.errors.legalName ? "border-destructive" : ""}`}
                    {...step1Form.register("legalName")}
                  />
                  {step1Form.formState.errors.legalName && (
                    <p className="text-xs text-destructive">{step1Form.formState.errors.legalName.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="registrationNumber">Registration / License Number</Label>
                  <Input
                    id="registrationNumber"
                    placeholder="SECP / SBP registration"
                    className="fi-green"
                    {...step1Form.register("registrationNumber")}
                  />
                </div>
                <div className="sm:col-span-2 space-y-2">
                  <Label htmlFor="address">Registered Address</Label>
                  <Input
                    id="address"
                    placeholder="Full address"
                    className={`fi-green ${step1Form.formState.errors.address ? "border-destructive" : ""}`}
                    {...step1Form.register("address")}
                  />
                  {step1Form.formState.errors.address && (
                    <p className="text-xs text-destructive">{step1Form.formState.errors.address.message}</p>
                  )}
                </div>
              </div>
            )}
            {step === 2 && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="mlroName">MLRO Name</Label>
                  <Input
                    id="mlroName"
                    placeholder="Money Laundering Reporting Officer"
                    className={`fi-green ${step2Form.formState.errors.mlroName ? "border-destructive" : ""}`}
                    {...step2Form.register("mlroName")}
                  />
                  {step2Form.formState.errors.mlroName && (
                    <p className="text-xs text-destructive">{step2Form.formState.errors.mlroName.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mlroEmail">MLRO Email</Label>
                  <Input
                    id="mlroEmail"
                    type="email"
                    placeholder="mlro@vasp.pk"
                    className={`fi-green ${step2Form.formState.errors.mlroEmail ? "border-destructive" : ""}`}
                    {...step2Form.register("mlroEmail")}
                  />
                  {step2Form.formState.errors.mlroEmail && (
                    <p className="text-xs text-destructive">{step2Form.formState.errors.mlroEmail.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="complianceEmail">Compliance Officer Email</Label>
                  <Input
                    id="complianceEmail"
                    type="email"
                    placeholder="compliance@vasp.pk"
                    className={`fi-green ${step2Form.formState.errors.complianceEmail ? "border-destructive" : ""}`}
                    {...step2Form.register("complianceEmail")}
                  />
                  {step2Form.formState.errors.complianceEmail && (
                    <p className="text-xs text-destructive">{step2Form.formState.errors.complianceEmail.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="adminEmail">Admin Email</Label>
                  <Input
                    id="adminEmail"
                    type="email"
                    placeholder="admin@vasp.pk"
                    className={`fi-green ${step2Form.formState.errors.adminEmail ? "border-destructive" : ""}`}
                    {...step2Form.register("adminEmail")}
                  />
                  {step2Form.formState.errors.adminEmail && (
                    <p className="text-xs text-destructive">{step2Form.formState.errors.adminEmail.message}</p>
                  )}
                </div>
              </div>
            )}
            {step === 3 && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="nocStatus">NOC / PVARA Status</Label>
                  <select
                    id="nocStatus"
                    className={`h-10 w-full rounded-md border border-input bg-background px-3 text-sm fi-green ${step3Form.formState.errors.nocStatus ? "border-destructive" : ""}`}
                    {...step3Form.register("nocStatus")}
                  >
                    <option value="">-- Select --</option>
                    <option value="noc_applied">NOC applied (pending)</option>
                    <option value="noc_granted">NOC granted</option>
                    <option value="license_applied">License applied</option>
                    <option value="licensed">Licensed VASP</option>
                  </select>
                  {step3Form.formState.errors.nocStatus && (
                    <p className="text-xs text-destructive">{step3Form.formState.errors.nocStatus.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="licenseType">License Type</Label>
                  <select
                    id="licenseType"
                    className={`h-10 w-full rounded-md border border-input bg-background px-3 text-sm fi-green ${step3Form.formState.errors.licenseType ? "border-destructive" : ""}`}
                    {...step3Form.register("licenseType")}
                  >
                    <option value="">-- Select --</option>
                    <option value="exchange">Exchange</option>
                    <option value="custodian">Custodian</option>
                    <option value="other">Other</option>
                  </select>
                  {step3Form.formState.errors.licenseType && (
                    <p className="text-xs text-destructive">{step3Form.formState.errors.licenseType.message}</p>
                  )}
                </div>
              </div>
            )}
            {step === 4 && (
              <div className="space-y-4">
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <p className="text-sm text-muted-foreground">Company</p>
                    <p className="font-medium">{companyName || "\u2014"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Legal Name</p>
                    <p className="font-medium">{legalName || "\u2014"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">MLRO</p>
                    <p className="font-medium">{mlroName || "\u2014"} &lt;{mlroEmail || "\u2014"}&gt;</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Compliance Email</p>
                    <p className="font-medium">{complianceEmail || "\u2014"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">NOC Status</p>
                    <p className="font-medium">{nocStatus || "\u2014"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">License Type</p>
                    <p className="font-medium">{licenseType || "\u2014"}</p>
                  </div>
                </div>
                {submitError && (
                  <p className="text-sm text-destructive">{submitError}</p>
                )}
              </div>
            )}
            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={handleBack} disabled={step === 1}>
                Back
              </Button>
              {step < 4 ? (
                <Button onClick={handleNext}>Next</Button>
              ) : (
                <Button onClick={handleSubmit} disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    "Submit application"
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </PublicShell>
  );
}

const ApplyForm = dynamic(() => Promise.resolve(ApplyFormInner), {
  loading: () => (
    <PublicShell>
      <div className="container max-w-2xl mx-auto py-16 pt-24 px-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    </PublicShell>
  ),
  ssr: false,
});

export default ApplyForm;
