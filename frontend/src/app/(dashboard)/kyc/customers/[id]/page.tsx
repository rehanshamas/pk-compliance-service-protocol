"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getCustomer,
  uploadDocument,
  listVerificationResults,
  verifyNadra,
  scoreRisk,
  runKycPipeline,
  startEdd,
  getEddCase,
  submitSourceOfFunds,
  approveEdd,
  rejectEdd,
  listDocuments,
  type Customer,
  type DocumentType,
  type VerificationResultDetail,
} from "@/lib/kyc-api";
import { ArrowLeft, CheckCircle, Clock, FileCheck, Play, ShieldCheck, ShieldAlert, ThumbsDown, ThumbsUp, TrendingUp, Upload } from "lucide-react";

const VERIFICATION_STEPS = [
  { key: "documents_uploaded", label: "Document Uploaded", icon: Clock },
  { key: "identity_verified", label: "Identity Verified", icon: CheckCircle },
  { key: "liveness_checked", label: "Liveness Checked", icon: CheckCircle },
  { key: "risk_scored", label: "Risk Scored", icon: CheckCircle },
  { key: "approved", label: "Approved", icon: CheckCircle },
] as const;

const STATUS_ORDER = [
  "initiated",
  "documents_uploaded",
  "identity_verified",
  "liveness_checked",
  "risk_scored",
  "approved",
  "rejected",
  "edd_required",
  "edd_in_progress",
];

function getStepStatus(
  stepKey: string,
  currentStatus: string
): "complete" | "current" | "pending" {
  const currentIdx = STATUS_ORDER.indexOf(currentStatus);
  const stepIdx = STATUS_ORDER.indexOf(stepKey);
  if (stepIdx < currentIdx) return "complete";
  if (stepIdx === currentIdx) return "current";
  return "pending";
}

export default function KycCustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [verificationResults, setVerificationResults] = useState<VerificationResultDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [verifyingNadra, setVerifyingNadra] = useState(false);
  const [nadraError, setNadraError] = useState<string | null>(null);
  const [scoringRisk, setScoringRisk] = useState(false);
  const [riskError, setRiskError] = useState<string | null>(null);
  const [runningKyc, setRunningKyc] = useState(false);
  const [kycPipelineError, setKycPipelineError] = useState<string | null>(null);
  const [eddCase, setEddCase] = useState<Awaited<ReturnType<typeof getEddCase>>>(null);
  const [startEddLoading, setStartEddLoading] = useState(false);
  const [sofText, setSofText] = useState("");
  const [submitSofLoading, setSubmitSofLoading] = useState(false);
  const [approveLoading, setApproveLoading] = useState(false);
  const [rejectLoading, setRejectLoading] = useState(false);
  const [rejectNotes, setRejectNotes] = useState("");
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [eddError, setEddError] = useState<string | null>(null);

  useEffect(() => {
    getCustomer(id)
      .then(setCustomer)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    listVerificationResults(id)
      .then((r) => setVerificationResults(r.items))
      .catch(() => {});
  }, [id, customer?.kycStatus]);

  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fileInput = form.querySelector('input[type="file"]') as HTMLInputElement;
    const typeSelect = form.querySelector('select[name="document_type"]') as HTMLSelectElement;
    if (!fileInput?.files?.[0] || !typeSelect?.value) return;
    setUploading(true);
    setUploadError(null);
    try {
      await uploadDocument(id, typeSelect.value as DocumentType, fileInput.files[0]);
      const [updated, vr] = await Promise.all([
        getCustomer(id),
        listVerificationResults(id),
      ]);
      setCustomer(updated);
      setVerificationResults(vr.items);
      form.reset();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleVerifyNadra = async () => {
    if (!customer?.cnicNumber) return;
    setVerifyingNadra(true);
    setNadraError(null);
    try {
      await verifyNadra(id);
      const [updated, vr] = await Promise.all([
        getCustomer(id),
        listVerificationResults(id),
      ]);
      setCustomer(updated);
      setVerificationResults(vr.items);
    } catch (err) {
      setNadraError(err instanceof Error ? err.message : "NADRA verification failed");
    } finally {
      setVerifyingNadra(false);
    }
  };

  const hasNadraResult = verificationResults.some(
    (r) => r.verificationType === "nadra"
  );
  const canVerifyNadra =
    customer?.cnicNumber &&
    !hasNadraResult &&
    ["documents_uploaded", "identity_verified"].includes(customer?.kycStatus ?? "");

  const handleScoreRisk = async () => {
    setScoringRisk(true);
    setRiskError(null);
    try {
      const updated = await scoreRisk(id);
      setCustomer(updated);
    } catch (err) {
      setRiskError(err instanceof Error ? err.message : "Risk scoring failed");
    } finally {
      setScoringRisk(false);
    }
  };

  const canScoreRisk = customer?.kycStatus === "liveness_checked";

  const canRunKycPipeline = ["documents_uploaded", "identity_verified", "liveness_checked"].includes(
    customer?.kycStatus ?? ""
  );

  const handleRunKycPipeline = async () => {
    setRunningKyc(true);
    setKycPipelineError(null);
    try {
      const result = await runKycPipeline(id);
      setCustomer(result.customer);
      const vr = await listVerificationResults(id);
      setVerificationResults(vr.items);
    } catch (err) {
      setKycPipelineError(err instanceof Error ? err.message : "Run KYC failed");
    } finally {
      setRunningKyc(false);
    }
  };

  useEffect(() => {
    if (!id || !customer?.kycStatus) return;
    if (customer.kycStatus === "edd_required" || customer.kycStatus === "edd_in_progress") {
      getEddCase(id).then(setEddCase).catch(() => setEddCase(null));
    }
  }, [id, customer?.kycStatus]);

  const handleStartEdd = async () => {
    setStartEddLoading(true);
    setEddError(null);
    try {
      await startEdd(id);
      const [updated, edd] = await Promise.all([getCustomer(id), getEddCase(id)]);
      setCustomer(updated);
      setEddCase(edd);
    } catch (err) {
      setEddError(err instanceof Error ? err.message : "Start EDD failed");
    } finally {
      setStartEddLoading(false);
    }
  };

  const handleSubmitSof = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!sofText.trim()) return;
    setSubmitSofLoading(true);
    setEddError(null);
    try {
      await submitSourceOfFunds(id, { source_of_funds: sofText.trim(), source_of_funds_verified: false });
      const edd = await getEddCase(id);
      setEddCase(edd);
    } catch (err) {
      setEddError(err instanceof Error ? err.message : "Submit failed");
    } finally {
      setSubmitSofLoading(false);
    }
  };

  const handleApproveEdd = async () => {
    setApproveLoading(true);
    setEddError(null);
    try {
      const updated = await approveEdd(id);
      setCustomer(updated);
      setEddCase(null);
    } catch (err) {
      setEddError(err instanceof Error ? err.message : "Approval failed");
    } finally {
      setApproveLoading(false);
    }
  };

  const handleRejectEdd = async () => {
    if (!rejectNotes.trim()) return;
    setRejectLoading(true);
    setEddError(null);
    try {
      const updated = await rejectEdd(id, rejectNotes.trim());
      setCustomer(updated);
      setEddCase(null);
      setRejectNotes("");
    } catch (err) {
      setEddError(err instanceof Error ? err.message : "Rejection failed");
    } finally {
      setRejectLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Loading...
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {error ?? "Customer not found"}
          </CardContent>
        </Card>
      </div>
    );
  }

  const canUpload = ["initiated", "documents_uploaded", "identity_verified"].includes(
    customer.kycStatus
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Verification Timeline</CardTitle>
              <CardDescription>KYC process steps and status</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {VERIFICATION_STEPS.map((step, i) => {
                  const status = getStepStatus(step.key, customer.kycStatus);
                  const Icon = step.icon;
                  return (
                    <div key={step.key} className="flex items-start gap-4">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                          status === "complete"
                            ? "bg-emerald-100 text-emerald-600"
                            : status === "current"
                              ? "bg-blue-100 text-blue-600"
                              : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {status === "complete" ? (
                          <CheckCircle className="h-5 w-5" />
                        ) : (
                          <Icon className="h-5 w-5" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{step.label}</p>
                        <p className="text-sm text-muted-foreground">
                          {status === "complete"
                            ? "Completed"
                            : status === "current"
                              ? "In progress"
                              : "Pending"}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {canRunKycPipeline && (
            <Card>
              <CardHeader>
                <CardTitle>Run KYC Pipeline</CardTitle>
                <CardDescription>
                  Run all applicable automated steps (NADRA, risk scoring) to advance customer through KYC
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  variant="default"
                  onClick={handleRunKycPipeline}
                  disabled={runningKyc}
                >
                  <Play className="mr-2 h-4 w-4" />
                  {runningKyc ? "Running..." : "Run KYC Pipeline"}
                </Button>
                {kycPipelineError && (
                  <p className="mt-2 text-sm text-destructive">{kycPipelineError}</p>
                )}
              </CardContent>
            </Card>
          )}

          {canVerifyNadra && (
            <Card>
              <CardHeader>
                <CardTitle>NADRA Verification</CardTitle>
                <CardDescription>
                  Verify CNIC with NADRA Verisys (government database)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  variant="outline"
                  onClick={handleVerifyNadra}
                  disabled={verifyingNadra}
                >
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  {verifyingNadra ? "Verifying..." : "Verify with NADRA"}
                </Button>
                {nadraError && (
                  <p className="mt-2 text-sm text-destructive">{nadraError}</p>
                )}
              </CardContent>
            </Card>
          )}

          {canScoreRisk && (
            <Card>
              <CardHeader>
                <CardTitle>Risk Scoring</CardTitle>
                <CardDescription>
                  Run rule-based risk assessment (nationality, PEP). Advances to risk_scored.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  variant="outline"
                  onClick={handleScoreRisk}
                  disabled={scoringRisk}
                >
                  <TrendingUp className="mr-2 h-4 w-4" />
                  {scoringRisk ? "Scoring..." : "Score Risk"}
                </Button>
                {riskError && (
                  <p className="mt-2 text-sm text-destructive">{riskError}</p>
                )}
              </CardContent>
            </Card>
          )}

          {customer.kycStatus === "edd_required" && (
            <Card>
              <CardHeader>
                <CardTitle>Enhanced Due Diligence</CardTitle>
                <CardDescription>
                  Customer flagged as high risk. Start EDD to collect enhanced docs, source of funds, and senior approval.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  variant="default"
                  onClick={handleStartEdd}
                  disabled={startEddLoading}
                >
                  <FileCheck className="mr-2 h-4 w-4" />
                  {startEddLoading ? "Starting..." : "Start EDD"}
                </Button>
                {eddError && (
                  <p className="mt-2 text-sm text-destructive">{eddError}</p>
                )}
              </CardContent>
            </Card>
          )}

          {customer.kycStatus === "edd_in_progress" && (
            <Card>
              <CardHeader>
                <CardTitle>EDD In Progress</CardTitle>
                <CardDescription>
                  Upload enhanced docs, submit source of funds, then request senior approval.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <form onSubmit={handleUpload} className="space-y-2">
                  <Label>Enhanced documents (proof of address, bank statement)</Label>
                  <div className="flex gap-2">
                    <select
                      name="document_type"
                      className="h-10 flex-1 rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="proof_of_address">Proof of Address</option>
                      <option value="bank_statement">Bank Statement</option>
                    </select>
                    <Input name="file" type="file" accept="image/jpeg,image/png,image/jpg,application/pdf" required />
                    <Button type="submit" disabled={uploading}>
                      {uploading ? "Uploading..." : "Upload"}
                    </Button>
                  </div>
                  {uploadError && <p className="text-sm text-destructive">{uploadError}</p>}
                </form>
                <form onSubmit={handleSubmitSof} className="space-y-2">
                  <Label htmlFor="sof">Source of funds</Label>
                  <textarea
                    id="sof"
                    value={sofText}
                    onChange={(e) => setSofText(e.target.value)}
                    className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    placeholder="Employment, business, inheritance, etc."
                  />
                  <Button type="submit" disabled={submitSofLoading || !sofText.trim()}>
                    {submitSofLoading ? "Saving..." : "Submit source of funds"}
                  </Button>
                  {eddError && <p className="text-sm text-destructive">{eddError}</p>}
                </form>
                <div className="flex gap-2 pt-2">
                  <Button variant="default" onClick={handleApproveEdd} disabled={approveLoading}>
                    <ThumbsUp className="mr-2 h-4 w-4" />
                    {approveLoading ? "Approving..." : "Approve"}
                  </Button>
                  <Button variant="outline" onClick={() => setRejectDialogOpen(true)} disabled={rejectLoading}>
                    <ThumbsDown className="mr-2 h-4 w-4" />
                    Reject
                  </Button>
                  {eddError && <p className="text-sm text-destructive">{eddError}</p>}
                </div>
                {rejectDialogOpen && (
                  <div className="rounded-md border p-4 space-y-2">
                    <Label htmlFor="reject_notes">Rejection notes (required)</Label>
                    <textarea
                      id="reject_notes"
                      value={rejectNotes}
                      onChange={(e) => setRejectNotes(e.target.value)}
                      className="min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                    <div className="flex gap-2">
                      <Button variant="destructive" onClick={handleRejectEdd} disabled={rejectLoading || !rejectNotes.trim()}>
                        {rejectLoading ? "Rejecting..." : "Confirm Reject"}
                      </Button>
                      <Button variant="ghost" onClick={() => { setRejectDialogOpen(false); setRejectNotes(""); }}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {(customer.kycStatus === "edd_required" || customer.kycStatus === "edd_in_progress") && (
            <Card>
              <CardHeader>
                <CardTitle>Enhanced Due Diligence (EDD)</CardTitle>
                <CardDescription>
                  {customer.kycStatus === "edd_required"
                    ? "High-risk customer. Start EDD to collect enhanced docs and source of funds."
                    : "Upload proof of address, bank statement, submit source of funds, and obtain senior approval."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {customer.kycStatus === "edd_required" && (
                  <Button
                    variant="default"
                    onClick={async () => {
                      try {
                        await startEdd(id);
                        const updated = await getCustomer(id);
                        setCustomer(updated);
                      } catch {}
                    }}
                  >
                    <FileCheck className="mr-2 h-4 w-4" />
                    Start EDD
                  </Button>
                )}
                {customer.kycStatus === "edd_in_progress" && (
                  <>
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const sof = (e.currentTarget.elements.namedItem("sof") as HTMLTextAreaElement)?.value;
                        if (!sof?.trim()) return;
                        try {
                          await submitSourceOfFunds(id, { source_of_funds: sof.trim(), source_of_funds_verified: false });
                          const updated = await getCustomer(id);
                          setCustomer(updated);
                        } catch {}
                      }}
                      className="space-y-2"
                    >
                      <Label>Source of Funds</Label>
                      <textarea
                        name="sof"
                        className="min-h-[80px] w-full rounded-md border px-3 py-2 text-sm"
                        placeholder="Describe source of funds (employment, business, inheritance, etc.)"
                      />
                      <Button type="submit" size="sm">
                        Submit Source of Funds
                      </Button>
                    </form>
                    <div className="flex gap-2">
                      <Button
                        variant="default"
                        size="sm"
                        onClick={async () => {
                          try {
                            const updated = await approveEdd(id);
                            setCustomer(updated);
                          } catch {}
                        }}
                      >
                        <ThumbsUp className="mr-2 h-4 w-4" />
                        Approve (MLRO)
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={async () => {
                          const notes = prompt("Rejection rationale (required):");
                          if (!notes?.trim()) return;
                          try {
                            const updated = await rejectEdd(id, notes);
                            setCustomer(updated);
                          } catch {}
                        }}
                      >
                        <ThumbsDown className="mr-2 h-4 w-4" />
                        Reject
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {verificationResults.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Verification Results</CardTitle>
                <CardDescription>OCR, face match, NADRA, and other verification outcomes</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {verificationResults.map((vr) => (
                    <div
                      key={vr.id}
                      className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                    >
                      <div>
                        <span className="font-medium capitalize">
                          {vr.verificationType.replace(/_/g, " ")}
                        </span>
                        <span className="text-muted-foreground"> ({vr.provider})</span>
                      </div>
                      <Badge
                        variant={
                          vr.status === "pass"
                            ? "success"
                            : vr.status === "fail"
                              ? "danger"
                              : "secondary"
                        }
                      >
                        {vr.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {canUpload && (
            <Card>
              <CardHeader>
                <CardTitle>Upload Document</CardTitle>
                <CardDescription>
                  Upload CNIC, passport, driving license, or selfie (JPEG, PNG, PDF, max 10MB)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleUpload} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="doc_type">Document Type</Label>
                      <select
                        id="doc_type"
                        name="document_type"
                        className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                        required
                      >
                        <option value="cnic">CNIC</option>
                        <option value="passport">Passport</option>
                        <option value="driving_license">Driving License</option>
                        <option value="selfie">Selfie</option>
                      </select>
                    </div>
                    <div>
                      <Label htmlFor="doc_file">File</Label>
                      <Input id="doc_file" name="file" type="file" accept="image/jpeg,image/png,image/jpg,application/pdf" required />
                    </div>
                  </div>
                  {uploadError && <p className="text-sm text-destructive">{uploadError}</p>}
                  <Button type="submit" disabled={uploading}>
                    <Upload className="mr-2 h-4 w-4" />
                    {uploading ? "Uploading..." : "Upload"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Customer Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Full Name</p>
                <p className="font-medium">{customer.fullName}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">CNIC</p>
                <p className="font-mono text-sm">{customer.cnicNumber ?? "—"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Date of Birth</p>
                <p>{customer.dob ?? "—"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Nationality</p>
                <p>{customer.nationality ?? "—"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Risk Tier</p>
                <Badge
                  variant={
                    customer.riskTier === "low"
                      ? "success"
                      : customer.riskTier === "medium"
                        ? "warning"
                        : "danger"
                  }
                >
                  {customer.riskTier}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">KYC Status</p>
                <Badge
                  variant={
                    customer.kycStatus === "approved"
                      ? "success"
                      : customer.kycStatus === "rejected"
                        ? "danger"
                        : "warning"
                  }
                >
                  {customer.kycStatus.replace(/_/g, " ")}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
