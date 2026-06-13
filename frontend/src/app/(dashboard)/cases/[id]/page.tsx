"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { apiRequest } from "@/lib/api";
import {
  getAllowedNextStatuses,
  CASE_STATUS_LABELS,
  CASE_NEXT_STEP_HELP,
  CASE_WORKFLOW_STEPS,
  isCaseClosed,
  type CaseStatus,
} from "@/lib/case-workflow";
import { toast } from "sonner";
import { ArrowLeft, Plus } from "lucide-react";

interface CaseDetail {
  id: string;
  title: string;
  status: string;
  assigned_to?: string | null;
  assignedTo?: string | null;
  created_at?: string;
  createdAt?: string;
  updated_at?: string;
  updatedAt?: string;
  linked_alerts_count?: number;
  linkedAlertsCount?: number;
  linked_alerts?: any[];
  linkedAlerts?: any[];
  linked_customers?: any[];
  linkedCustomers?: any[];
  notes?: any[];
}

interface CaseNote {
  id: string;
  content: string;
  created_by?: string;
  createdBy?: string;
  created_at?: string;
  createdAt?: string;
}

export default function CaseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const caseId = params.id as string;

  const [caseItem, setCaseItem] = useState<CaseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [noteText, setNoteText] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<CaseStatus | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Read user role from localStorage
  const userRole = useMemo(() => {
    if (typeof window === "undefined") return "";
    try {
      const auth = JSON.parse(localStorage.getItem("cip_mock_auth") || "{}");
      return (auth.role ?? auth.user?.role ?? "") as string;
    } catch {
      return "";
    }
  }, []);

  const fetchCase = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiRequest<CaseDetail>(`/cases/${caseId}`);
      setCaseItem(data);
    } catch (e: any) {
      setError(e.message || "Failed to load case");
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    fetchCase();
  }, [fetchCase]);

  const handleStatusSelect = (newStatus: string) => {
    setPendingStatus(newStatus as CaseStatus);
    setConfirmOpen(true);
  };

  const handleStatusConfirm = async () => {
    if (!caseItem || !pendingStatus) return;
    setConfirmOpen(false);
    setUpdatingStatus(true);
    try {
      const updated = await apiRequest<CaseDetail>(`/cases/${caseId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: pendingStatus }),
      });
      setCaseItem(updated);
      toast.success(`Status changed to ${CASE_STATUS_LABELS[pendingStatus]}`);
    } catch (e: any) {
      toast.error(e.message || "Failed to update status");
    } finally {
      setUpdatingStatus(false);
      setPendingStatus(null);
    }
  };

  const handleAddNote = async () => {
    if (!noteText.trim()) return;
    setAddingNote(true);
    try {
      await apiRequest(`/cases/${caseId}/notes`, {
        method: "POST",
        body: JSON.stringify({ content: noteText.trim() }),
      });
      setNoteText("");
      // Refresh case to get updated notes
      await fetchCase();
    } catch (e: any) {
      toast.error(e.message || "Failed to add note");
    } finally {
      setAddingNote(false);
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
            Loading case...
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !caseItem) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {error || "Case not found"}
          </CardContent>
        </Card>
      </div>
    );
  }

  const assignedTo = caseItem.assigned_to ?? caseItem.assignedTo ?? null;
  const createdAt = caseItem.created_at ?? caseItem.createdAt ?? "";
  const updatedAt = caseItem.updated_at ?? caseItem.updatedAt ?? "";
  const linkedAlerts = caseItem.linked_alerts ?? caseItem.linkedAlerts ?? [];
  const linkedCustomers = caseItem.linked_customers ?? caseItem.linkedCustomers ?? [];
  const notes: CaseNote[] = caseItem.notes ?? [];

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
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>{caseItem.title}</CardTitle>
                <Badge variant="secondary" className="mt-2">
                  {CASE_STATUS_LABELS[caseItem.status as CaseStatus] ?? caseItem.status.replace(/_/g, " ")}
                </Badge>
              </div>
              {(() => {
                const allowed = getAllowedNextStatuses(caseItem.status);
                const isReopen = isCaseClosed(caseItem.status) && allowed.length > 0;
                const isMLRO = userRole.toLowerCase() === "mlro";

                // Closed cases: only MLRO can reopen
                if (isReopen && !isMLRO) {
                  return (
                    <p className="text-xs text-muted-foreground max-w-[200px] text-right">
                      Only the MLRO can reopen closed cases.
                    </p>
                  );
                }

                if (allowed.length > 0) {
                  return (
                    <Select value="" onValueChange={handleStatusSelect} disabled={updatingStatus}>
                      <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="Change status..." />
                      </SelectTrigger>
                      <SelectContent>
                        {allowed.map((s) => (
                          <SelectItem key={s} value={s}>
                            {CASE_STATUS_LABELS[s]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  );
                }

                return null;
              })()}
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">{assignedTo ? `Assigned to ${assignedTo}` : "Unassigned"}</p>
            </CardContent>
          </Card>

          {/* Next-step guidance banner */}
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="py-3">
              <p className="text-sm font-medium">Next Steps</p>
              <p className="text-sm text-muted-foreground">
                {CASE_NEXT_STEP_HELP[caseItem.status as CaseStatus] ?? ""}
              </p>
            </CardContent>
          </Card>

          {/* Workflow timeline */}
          <Card>
            <CardHeader>
              <CardTitle>Workflow Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3">
                {CASE_WORKFLOW_STEPS.map((step, i) => {
                  const currentIdx = CASE_WORKFLOW_STEPS.findIndex(
                    (s) => s.status === caseItem.status
                  );
                  const isCurrent = step.status === caseItem.status;
                  const isPast = i < currentIdx;
                  return (
                    <div key={step.status} className="flex items-center gap-3">
                      <div
                        className={`h-3 w-3 rounded-full shrink-0 ${
                          isCurrent
                            ? "bg-primary"
                            : isPast
                            ? "bg-primary/40"
                            : "bg-muted"
                        }`}
                      />
                      <div>
                        <span
                          className={
                            isCurrent
                              ? "font-medium text-primary"
                              : "text-muted-foreground text-sm"
                          }
                        >
                          {step.label}
                        </span>
                        {isCurrent && (
                          <p className="text-xs text-muted-foreground">
                            {step.description}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex gap-4">
                  <div className="h-2 w-2 shrink-0 rounded-full bg-emerald-500 mt-1.5" />
                  <div>
                    <p className="font-medium text-sm">Case created</p>
                    <p className="text-muted-foreground text-sm">{createdAt ? new Date(createdAt).toLocaleString() : "—"}</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="h-2 w-2 shrink-0 rounded-full bg-blue-500 mt-1.5" />
                  <div>
                    <p className="font-medium text-sm">Last updated</p>
                    <p className="text-muted-foreground text-sm">{updatedAt ? new Date(updatedAt).toLocaleString() : "—"}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
              <p className="text-sm text-muted-foreground">Add investigation notes</p>
            </CardHeader>
            <CardContent className="space-y-4">
              {notes.length > 0 && (
                <div className="space-y-3">
                  {notes.map((note) => (
                    <div key={note.id} className="rounded-md border p-3">
                      <p className="text-sm">{note.content}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {note.created_by ?? note.createdBy ?? "Unknown"} &middot;{" "}
                        {(note.created_at ?? note.createdAt) ? new Date(note.created_at ?? note.createdAt!).toLocaleString() : ""}
                      </p>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Input
                  placeholder="Add a note..."
                  className="flex-1"
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleAddNote(); }}
                />
                <Button size="icon" onClick={handleAddNote} disabled={addingNote || !noteText.trim()}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Linked Alerts</CardTitle>
              <p className="text-sm text-muted-foreground">{linkedAlerts.length} alert(s)</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {linkedAlerts.map((a: any) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between rounded-md border p-3 text-sm cursor-pointer hover:bg-muted/50"
                    onClick={() => router.push("/analytics/alerts")}
                  >
                    <span className="line-clamp-1">{a.summary ?? a.title ?? a.id}</span>
                    <Badge variant="outline">{a.severity ?? "—"}</Badge>
                  </div>
                ))}
                {linkedAlerts.length === 0 && (
                  <p className="text-sm text-muted-foreground py-2">No linked alerts</p>
                )}
              </div>
              <Button variant="outline" className="mt-2 w-full" onClick={() => router.push("/analytics/alerts")}>
                Link Alert
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Linked Customers</CardTitle>
              <p className="text-sm text-muted-foreground">{linkedCustomers.length} customer(s)</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {linkedCustomers.map((c: any) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between rounded-md border p-3 text-sm cursor-pointer hover:bg-muted/50"
                    onClick={() => router.push(`/customers/${c.id}`)}
                  >
                    <span>{c.full_name ?? c.fullName ?? c.id}</span>
                    <Badge variant="outline">{c.risk_tier ?? c.riskTier ?? "—"}</Badge>
                  </div>
                ))}
                {linkedCustomers.length === 0 && (
                  <p className="text-sm text-muted-foreground py-2">No linked customers</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Confirmation dialog for status transitions */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Status Change</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  {CASE_STATUS_LABELS[caseItem.status as CaseStatus] ?? caseItem.status}
                  {" "}&#8594;{" "}
                  {pendingStatus ? CASE_STATUS_LABELS[pendingStatus] : ""}
                </p>
                {pendingStatus && (
                  <p className="text-muted-foreground text-sm">
                    {CASE_NEXT_STEP_HELP[pendingStatus]}
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingStatus(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleStatusConfirm}>
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
