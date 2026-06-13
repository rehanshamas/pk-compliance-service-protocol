"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { apiRequest } from "@/lib/api";
import { toast } from "sonner";
import { ArrowLeft, Download } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface IsarDetail {
  id: string;
  subject_name?: string;
  subjectName?: string;
  suspicion_type?: string;
  suspicionType?: string;
  status: string;
  submitted_by?: string | null;
  submittedBy?: string | null;
  created_at?: string;
  createdAt?: string;
  narrative?: string;
  evidence?: string;
  customer_id?: string;
  customer?: any;
  sections?: any;
  // 5 ISAR sections
  section_1_subject?: any;
  section_2_suspicion?: any;
  section_3_evidence?: any;
  section_4_analysis?: any;
  section_5_recommendation?: any;
}

function getStatusVariant(s: string): "success" | "danger" | "warning" | "secondary" {
  if (s === "approved" || s === "filed_as_str") return "success";
  if (s === "rejected") return "danger";
  if (s === "submitted_for_review") return "warning";
  return "secondary";
}

export default function IsarReviewPage() {
  const params = useParams();
  const router = useRouter();
  const isarId = params.id as string;

  const [isar, setIsar] = useState<IsarDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [approveOpen, setApproveOpen] = useState(false);
  const [approveNotes, setApproveNotes] = useState("");
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectRationale, setRejectRationale] = useState("");
  const [submitOpen, setSubmitOpen] = useState(false);
  const [fileStrOpen, setFileStrOpen] = useState(false);
  const [downloading, setDownloading] = useState<"pdf" | "docx" | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchIsar = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiRequest<IsarDetail>(`/isars/${isarId}`);
      setIsar(data);
    } catch (e: any) {
      setError(e.message || "Failed to load ISAR");
    } finally {
      setLoading(false);
    }
  }, [isarId]);

  useEffect(() => {
    fetchIsar();
  }, [fetchIsar]);

  const handleDownload = async (format: "pdf" | "docx") => {
    setDownloading(format);
    try {
      const token = localStorage.getItem("cip_access_token");
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const endpoint = format === "docx" ? "download-docx" : "download-pdf";
      const response = await fetch(`${API_BASE}/api/v1/isars/${isarId}/${endpoint}`, { headers });
      if (!response.ok) throw new Error("Download failed");

      const blob = await response.blob();
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `isar-${isarId}-form-a7.${format}`;
      link.click();
      URL.revokeObjectURL(link.href);
      toast.success(`ISAR downloaded as ${format.toUpperCase()}`);
    } catch (e: any) {
      toast.error(e.message || "Download failed");
    } finally {
      setDownloading(null);
    }
  };

  const handleApprove = async () => {
    setActionLoading(true);
    try {
      await apiRequest(`/isars/${isarId}/approve`, {
        method: "POST",
        body: JSON.stringify({ notes: approveNotes }),
      });
      setApproveOpen(false);
      setApproveNotes("");
      await fetchIsar();
      toast.success("ISAR approved. Next: File as STR when ready.");
    } catch (e: any) {
      toast.error(e.message || "Failed to approve ISAR");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectRationale.trim()) return;
    setActionLoading(true);
    try {
      await apiRequest(`/isars/${isarId}/reject`, {
        method: "POST",
        body: JSON.stringify({ rationale: rejectRationale }),
      });
      setRejectOpen(false);
      setRejectRationale("");
      await fetchIsar();
      toast.success("ISAR rejected. Submitter notified.");
    } catch (e: any) {
      toast.error(e.message || "Failed to reject ISAR");
    } finally {
      setActionLoading(false);
    }
  };

  const handleSubmitForReview = async () => {
    setActionLoading(true);
    try {
      await apiRequest(`/isars/${isarId}/submit`, {
        method: "POST",
      });
      setSubmitOpen(false);
      await fetchIsar();
      toast.success("ISAR submitted for MLRO review.");
    } catch (e: any) {
      toast.error(e.message || "Failed to submit ISAR for review");
    } finally {
      setActionLoading(false);
    }
  };

  const handleFileAsStr = async () => {
    setActionLoading(true);
    try {
      await apiRequest(`/isars/${isarId}/file-as-str`, {
        method: "POST",
      });
      setFileStrOpen(false);
      await fetchIsar();
      toast.success("STR created. Download XML from Reports \u2192 STR/CTR.");
    } catch (e: any) {
      toast.error(e.message || "Failed to file ISAR as STR");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Loading ISAR...
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !isar) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {error || "ISAR not found"}
          </CardContent>
        </Card>
      </div>
    );
  }

  const subjectName = isar.subject_name ?? isar.subjectName ?? "";
  const suspicionType = isar.suspicion_type ?? isar.suspicionType ?? "";
  const submittedBy = isar.submitted_by ?? isar.submittedBy ?? null;
  const createdAt = isar.created_at ?? isar.createdAt ?? "";

  const canApprove = isar.status === "submitted_for_review";
  const canSubmit = isar.status === "draft";
  const canFileAsStr = isar.status === "approved";

  // 5 ISAR sections from API
  const sections = isar.sections ?? {};
  const s1 = isar.section_1_subject ?? sections.subject ?? null;
  const s2 = isar.section_2_suspicion ?? sections.suspicion ?? null;
  const s3 = isar.section_3_evidence ?? sections.evidence ?? null;
  const s4 = isar.section_4_analysis ?? sections.analysis ?? null;
  const s5 = isar.section_5_recommendation ?? sections.recommendation ?? null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Badge variant={getStatusVariant(isar.status)}>
          {isar.status.replace(/_/g, " ")}
        </Badge>
      </div>

      {/* Workflow status timeline */}
      <div className="flex items-center gap-2 text-sm">
        {[
          { key: "draft", label: "Draft" },
          { key: "submitted_for_review", label: "Submitted" },
          { key: "approved", label: "Approved" },
          { key: "filed_as_str", label: "Filed as STR" },
        ].map((step, idx, arr) => {
          const statusOrder = ["draft", "submitted_for_review", "approved", "filed_as_str"];
          const currentIdx = statusOrder.indexOf(isar.status);
          const stepIdx = statusOrder.indexOf(step.key);
          const isRejected = isar.status === "rejected";
          const isActive = step.key === isar.status || (isRejected && step.key === "submitted_for_review");
          const isPast = !isRejected && stepIdx < currentIdx;
          return (
            <div key={step.key} className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <div
                  className={`h-2.5 w-2.5 rounded-full ${
                    isActive
                      ? isRejected
                        ? "bg-destructive"
                        : "bg-primary"
                      : isPast
                        ? "bg-green-500"
                        : "bg-muted-foreground/30"
                  }`}
                />
                <span
                  className={
                    isActive
                      ? "font-medium"
                      : isPast
                        ? "text-muted-foreground"
                        : "text-muted-foreground/50"
                  }
                >
                  {step.label}
                  {isRejected && step.key === "submitted_for_review" ? " (Rejected)" : ""}
                </span>
              </div>
              {idx < arr.length - 1 && (
                <div
                  className={`h-px w-6 ${
                    isPast ? "bg-green-500" : "bg-muted-foreground/30"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle>ISAR #{isar.id}</CardTitle>
              <p className="text-sm text-muted-foreground">
                Submitted by {submittedBy ?? "—"} &middot; {createdAt ? new Date(createdAt).toLocaleString() : "—"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                PVARA Form A7 (Annex A) — PVARA/REG/AML-REG/2025-1
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => handleDownload("pdf")} disabled={!!downloading}>
                <Download className="mr-2 h-4 w-4" />
                {downloading === "pdf" ? "Downloading..." : "PDF"}
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleDownload("docx")} disabled={!!downloading}>
                <Download className="mr-2 h-4 w-4" />
                {downloading === "docx" ? "Downloading..." : "DOCX"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Basic info */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-sm text-muted-foreground">Subject</p>
              <p className="font-medium">{subjectName}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Suspicion Type</p>
              <p className="font-medium">{suspicionType}</p>
            </div>
          </div>

          {/* Narrative */}
          {isar.narrative && (
            <div>
              <p className="text-sm text-muted-foreground">Narrative</p>
              <p className="text-sm whitespace-pre-wrap">{isar.narrative}</p>
            </div>
          )}

          {/* 5 ISAR Sections */}
          {s1 && (
            <div className="rounded-md border p-4">
              <h3 className="font-medium mb-2">Section 1: Subject Information</h3>
              <p className="text-xs text-muted-foreground mb-2">Details of the person filing this report</p>
              <pre className="text-sm text-muted-foreground whitespace-pre-wrap">{typeof s1 === "string" ? s1 : JSON.stringify(s1, null, 2)}</pre>
            </div>
          )}
          {s2 && (
            <div className="rounded-md border p-4">
              <h3 className="font-medium mb-2">Section 2: Suspicion Details</h3>
              <p className="text-xs text-muted-foreground mb-2">Subject of the suspicious activity</p>
              <pre className="text-sm text-muted-foreground whitespace-pre-wrap">{typeof s2 === "string" ? s2 : JSON.stringify(s2, null, 2)}</pre>
            </div>
          )}
          {s3 && (
            <div className="rounded-md border p-4">
              <h3 className="font-medium mb-2">Section 3: Supporting Evidence</h3>
              <p className="text-xs text-muted-foreground mb-2">Transaction details that triggered suspicion</p>
              <pre className="text-sm text-muted-foreground whitespace-pre-wrap">{typeof s3 === "string" ? s3 : JSON.stringify(s3, null, 2)}</pre>
            </div>
          )}
          {s4 && (
            <div className="rounded-md border p-4">
              <h3 className="font-medium mb-2">Section 4: Analysis</h3>
              <p className="text-xs text-muted-foreground mb-2">Supporting documentation and analysis</p>
              <pre className="text-sm text-muted-foreground whitespace-pre-wrap">{typeof s4 === "string" ? s4 : JSON.stringify(s4, null, 2)}</pre>
            </div>
          )}
          {s5 && (
            <div className="rounded-md border p-4">
              <h3 className="font-medium mb-2">Section 5: Recommendation</h3>
              <p className="text-xs text-muted-foreground mb-2">MLRO's determination and recommended action</p>
              <pre className="text-sm text-muted-foreground whitespace-pre-wrap">{typeof s5 === "string" ? s5 : JSON.stringify(s5, null, 2)}</pre>
            </div>
          )}

          {/* No sections fallback */}
          {!s1 && !s2 && !s3 && !s4 && !s5 && !isar.narrative && (
            <div>
              <p className="text-sm text-muted-foreground">Supporting Evidence</p>
              <p className="text-sm">No detailed sections available.</p>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2 pt-4">
            {canSubmit && (
              <AlertDialog open={submitOpen} onOpenChange={setSubmitOpen}>
                <Button variant="default" onClick={() => setSubmitOpen(true)} disabled={actionLoading}>
                  {actionLoading ? "Submitting..." : "Submit for Review"}
                </Button>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Submit ISAR for Review</AlertDialogTitle>
                    <AlertDialogDescription>
                      This sends the ISAR to the MLRO for review. You cannot edit it after submission. The MLRO will approve, reject, or request changes.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleSubmitForReview} disabled={actionLoading}>
                      {actionLoading ? "Submitting..." : "Submit"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}

            {canApprove && (
              <>
                <AlertDialog open={approveOpen} onOpenChange={setApproveOpen}>
                  <Button variant="default" onClick={() => setApproveOpen(true)} disabled={actionLoading}>
                    Approve
                  </Button>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Approve ISAR?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will approve the ISAR and it will be ready to be filed as an STR. This action will be recorded in the audit log.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="py-4">
                      <Label htmlFor="approve-notes">Notes (optional)</Label>
                      <Input
                        id="approve-notes"
                        value={approveNotes}
                        onChange={(e) => setApproveNotes(e.target.value)}
                        placeholder="e.g. Reviewed and confirmed..."
                        className="mt-1"
                      />
                    </div>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleApprove} disabled={actionLoading}>
                        {actionLoading ? "Approving..." : "Approve"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                <AlertDialog open={rejectOpen} onOpenChange={(o) => { setRejectOpen(o); if (!o) setRejectRationale(""); }}>
                  <Button variant="destructive" onClick={() => setRejectOpen(true)} disabled={actionLoading}>
                    Reject
                  </Button>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Reject ISAR?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Rejecting requires a rationale. The submitter will be notified and may resubmit with changes.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="py-4">
                      <Label htmlFor="reject-rationale">Rationale (required)</Label>
                      <Input
                        id="reject-rationale"
                        value={rejectRationale}
                        onChange={(e) => setRejectRationale(e.target.value)}
                        placeholder="e.g. Insufficient evidence..."
                        className="mt-1"
                      />
                    </div>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleReject}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        disabled={!rejectRationale.trim() || actionLoading}
                      >
                        {actionLoading ? "Rejecting..." : "Reject"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}

            {canFileAsStr && (
              <AlertDialog open={fileStrOpen} onOpenChange={setFileStrOpen}>
                <Button variant="default" onClick={() => setFileStrOpen(true)} disabled={actionLoading}>
                  {actionLoading ? "Filing..." : "File as STR"}
                </Button>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>File as Suspicious Transaction Report</AlertDialogTitle>
                    <AlertDialogDescription>
                      This creates a goAML-format STR linked to this ISAR. After filing, download the XML from Reports &rarr; STR/CTR and submit it to the FMU's goAML portal.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleFileAsStr} disabled={actionLoading}>
                      {actionLoading ? "Filing..." : "File as STR"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
