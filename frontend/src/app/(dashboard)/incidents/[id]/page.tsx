"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { apiRequest } from "@/lib/api";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Clock, AlertTriangle, CheckCircle2, Shield, FileText } from "lucide-react";

interface IncidentDetail {
  id: string;
  tenant_id?: string;
  title: string;
  severity: "critical" | "high" | "medium" | "low";
  category: string;
  status: string;
  description?: string;
  detected_at?: string;
  notification_deadline?: string;
  notified_at?: string;
  report_deadline?: string;
  detailed_report?: Record<string, string> | null;
  report_submitted_at?: string;
  affected_customers_count?: number;
  affected_systems?: string;
  containment_steps?: string;
  root_cause?: string;
  remediation_steps?: string;
  prevention_measures?: string;
  resolution_notes?: string;
  notification_overdue?: boolean;
  report_overdue?: boolean;
  created_at?: string;
  updated_at?: string;
}

function getSeverityVariant(s: string): "danger" | "warning" | "success" | "secondary" {
  if (s === "critical" || s === "high") return "danger";
  if (s === "medium") return "warning";
  if (s === "low") return "success";
  return "secondary";
}

function getStatusVariant(s: string): "danger" | "warning" | "success" | "info" | "secondary" {
  if (s === "detected") return "danger";
  if (s === "authority_notified" || s === "investigating") return "warning";
  if (s === "report_submitted") return "info";
  if (s === "resolved" || s === "closed") return "success";
  return "secondary";
}

function formatCategory(cat: string): string {
  return cat.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDateTime(dt?: string | null): string {
  if (!dt) return "—";
  return new Date(dt).toLocaleString();
}

function getTimeRemaining(deadline?: string | null): { text: string; overdue: boolean } {
  if (!deadline) return { text: "—", overdue: false };
  const now = new Date().getTime();
  const dl = new Date(deadline).getTime();
  const diff = dl - now;
  if (diff <= 0) {
    const mins = Math.abs(Math.floor(diff / 60000));
    if (mins < 60) return { text: `${mins}m overdue`, overdue: true };
    const hrs = Math.floor(mins / 60);
    if (hrs < 48) return { text: `${hrs}h ${mins % 60}m overdue`, overdue: true };
    return { text: `${Math.floor(hrs / 24)}d overdue`, overdue: true };
  }
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return { text: `${mins}m remaining`, overdue: false };
  const hrs = Math.floor(mins / 60);
  if (hrs < 48) return { text: `${hrs}h ${mins % 60}m remaining`, overdue: false };
  return { text: `${Math.floor(hrs / 24)}d ${hrs % 24}h remaining`, overdue: false };
}

const STATUS_STEPS = [
  { key: "detected", label: "Detected" },
  { key: "authority_notified", label: "Authority Notified" },
  { key: "investigating", label: "Investigating" },
  { key: "report_submitted", label: "Report Submitted" },
  { key: "resolved", label: "Resolved" },
  { key: "closed", label: "Closed" },
];

export default function IncidentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const incidentId = params.id as string;

  const [incident, setIncident] = useState<IncidentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Action states
  const [notifying, setNotifying] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [submittingReport, setSubmittingReport] = useState(false);
  const [resolveOpen, setResolveOpen] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Report form fields
  const [reportForm, setReportForm] = useState({
    nature_and_scope: "",
    timeline_of_events: "",
    affected_data_or_systems: "",
    containment_actions: "",
    root_cause_analysis: "",
    remediation_steps: "",
    prevention_measures: "",
  });

  // Resolve form
  const [resolutionNotes, setResolutionNotes] = useState("");

  // Edit form
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    affected_systems: "",
    affected_customers_count: 0,
    containment_steps: "",
  });

  const fetchIncident = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiRequest<IncidentDetail>(`/incidents/${incidentId}`);
      setIncident(data);
      setEditForm({
        title: data.title || "",
        description: data.description || "",
        affected_systems: data.affected_systems || "",
        affected_customers_count: data.affected_customers_count || 0,
        containment_steps: data.containment_steps || "",
      });
    } catch (e: any) {
      setError(e.message || "Failed to load incident");
    } finally {
      setLoading(false);
    }
  }, [incidentId]);

  useEffect(() => {
    fetchIncident();
  }, [fetchIncident]);

  const handleNotifyAuthority = async () => {
    setNotifying(true);
    try {
      await apiRequest(`/incidents/${incidentId}/notify-authority`, { method: "POST" });
      toast.success("Authority notified successfully");
      await fetchIncident();
    } catch (e: any) {
      toast.error(e.message || "Failed to notify authority");
    } finally {
      setNotifying(false);
    }
  };

  const handleSubmitReport = async () => {
    setSubmittingReport(true);
    try {
      await apiRequest(`/incidents/${incidentId}/submit-report`, {
        method: "POST",
        body: JSON.stringify(reportForm),
      });
      toast.success("Detailed report submitted successfully");
      setReportOpen(false);
      setReportForm({
        nature_and_scope: "",
        timeline_of_events: "",
        affected_data_or_systems: "",
        containment_actions: "",
        root_cause_analysis: "",
        remediation_steps: "",
        prevention_measures: "",
      });
      await fetchIncident();
    } catch (e: any) {
      toast.error(e.message || "Failed to submit report");
    } finally {
      setSubmittingReport(false);
    }
  };

  const handleResolve = async () => {
    setResolving(true);
    try {
      await apiRequest(`/incidents/${incidentId}/resolve`, {
        method: "POST",
        body: JSON.stringify({ resolution_notes: resolutionNotes || undefined }),
      });
      toast.success("Incident resolved");
      setResolveOpen(false);
      setResolutionNotes("");
      await fetchIncident();
    } catch (e: any) {
      toast.error(e.message || "Failed to resolve incident");
    } finally {
      setResolving(false);
    }
  };

  const handleEdit = async () => {
    setSaving(true);
    try {
      await apiRequest(`/incidents/${incidentId}`, {
        method: "PATCH",
        body: JSON.stringify(editForm),
      });
      toast.success("Incident updated");
      setEditOpen(false);
      await fetchIncident();
    } catch (e: any) {
      toast.error(e.message || "Failed to update incident");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" onClick={() => router.push("/incidents")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Incidents
        </Button>
        <Card>
          <CardContent className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !incident) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" onClick={() => router.push("/incidents")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Incidents
        </Button>
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {error || "Incident not found"}
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentStatusIdx = STATUS_STEPS.findIndex((s) => s.key === incident.status);
  const notifDeadline = getTimeRemaining(incident.notification_deadline);
  const reportDeadline = getTimeRemaining(incident.report_deadline);

  return (
    <div className="space-y-6">
      {/* Back link */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.push("/incidents")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Incidents
        </Button>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{incident.title}</h1>
          <div className="mt-2 flex items-center gap-2">
            <Badge variant={getSeverityVariant(incident.severity)}>
              {incident.severity}
            </Badge>
            <Badge variant={getStatusVariant(incident.status)}>
              {incident.status.replace(/_/g, " ")}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {formatCategory(incident.category)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {incident.status === "detected" && (
            <Button onClick={handleNotifyAuthority} disabled={notifying}>
              <Shield className="mr-2 h-4 w-4" />
              {notifying ? "Notifying..." : "Notify Authority"}
            </Button>
          )}
          {(incident.status === "authority_notified" || incident.status === "investigating") &&
            !incident.report_submitted_at && (
              <Button onClick={() => setReportOpen(true)}>
                <FileText className="mr-2 h-4 w-4" />
                Submit Report
              </Button>
            )}
          {incident.status === "report_submitted" && (
            <Button onClick={() => setResolveOpen(true)}>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Resolve
            </Button>
          )}
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            Edit
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main content - left 2 cols */}
        <div className="lg:col-span-2 space-y-6">
          {/* Details Card */}
          <Card>
            <CardHeader>
              <CardTitle>Incident Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {incident.description && (
                <div>
                  <p className="text-sm text-muted-foreground">Description</p>
                  <p className="text-sm mt-1">{incident.description}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Detected At</p>
                  <p className="text-sm font-medium">{formatDateTime(incident.detected_at)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Affected Customers</p>
                  <p className="text-sm font-medium">
                    {incident.affected_customers_count ?? "—"}
                  </p>
                </div>
              </div>
              {incident.affected_systems && (
                <div>
                  <p className="text-sm text-muted-foreground">Affected Systems</p>
                  <p className="text-sm mt-1">{incident.affected_systems}</p>
                </div>
              )}
              {incident.containment_steps && (
                <div>
                  <p className="text-sm text-muted-foreground">Containment Steps</p>
                  <p className="text-sm mt-1">{incident.containment_steps}</p>
                </div>
              )}
              {incident.root_cause && (
                <div>
                  <p className="text-sm text-muted-foreground">Root Cause</p>
                  <p className="text-sm mt-1">{incident.root_cause}</p>
                </div>
              )}
              {incident.remediation_steps && (
                <div>
                  <p className="text-sm text-muted-foreground">Remediation Steps</p>
                  <p className="text-sm mt-1">{incident.remediation_steps}</p>
                </div>
              )}
              {incident.prevention_measures && (
                <div>
                  <p className="text-sm text-muted-foreground">Prevention Measures</p>
                  <p className="text-sm mt-1">{incident.prevention_measures}</p>
                </div>
              )}
              {incident.resolution_notes && (
                <div>
                  <p className="text-sm text-muted-foreground">Resolution Notes</p>
                  <p className="text-sm mt-1">{incident.resolution_notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Timeline Card */}
          <Card>
            <CardHeader>
              <CardTitle>Status Timeline</CardTitle>
              <CardDescription>Incident progression through regulatory workflow</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {STATUS_STEPS.map((step, idx) => {
                  const isCompleted = idx <= currentStatusIdx;
                  const isCurrent = idx === currentStatusIdx;
                  let timestamp = "";
                  if (step.key === "detected") timestamp = formatDateTime(incident.detected_at || incident.created_at);
                  if (step.key === "authority_notified") timestamp = formatDateTime(incident.notified_at);
                  if (step.key === "report_submitted") timestamp = formatDateTime(incident.report_submitted_at);
                  if (step.key === "resolved" && (incident.status === "resolved" || incident.status === "closed"))
                    timestamp = formatDateTime(incident.updated_at);

                  return (
                    <div key={step.key} className="flex gap-4">
                      <div
                        className={`h-2 w-2 shrink-0 rounded-full mt-1.5 ${
                          isCurrent
                            ? "bg-primary"
                            : isCompleted
                              ? "bg-emerald-500"
                              : "bg-muted-foreground/30"
                        }`}
                      />
                      <div>
                        <p
                          className={`text-sm ${
                            isCurrent
                              ? "font-semibold text-foreground"
                              : isCompleted
                                ? "font-medium text-foreground"
                                : "text-muted-foreground"
                          }`}
                        >
                          {step.label}
                        </p>
                        {timestamp && timestamp !== "—" && (
                          <p className="text-muted-foreground text-sm">{timestamp}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Detailed Report Card (if submitted) */}
          {incident.detailed_report && (
            <Card>
              <CardHeader>
                <CardTitle>48-Hour Detailed Report</CardTitle>
                <CardDescription>
                  Submitted {formatDateTime(incident.report_submitted_at)}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {Object.entries(incident.detailed_report).map(([key, value]) => (
                  <div key={key}>
                    <p className="text-sm text-muted-foreground">
                      {key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                    </p>
                    <p className="text-sm mt-1">{value || "—"}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right sidebar */}
        <div className="space-y-6">
          {/* Deadlines Card */}
          <Card>
            <CardHeader>
              <CardTitle>Regulatory Deadlines</CardTitle>
              <CardDescription>PVARA compliance requirements</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm font-medium">1-Hour Notification</p>
                </div>
                {incident.notified_at ? (
                  <p className="mt-1 text-sm text-emerald-600">
                    Notified at {formatDateTime(incident.notified_at)}
                  </p>
                ) : (
                  <p className={`mt-1 text-sm ${notifDeadline.overdue ? "text-red-500 font-medium" : "text-muted-foreground"}`}>
                    {notifDeadline.overdue && <AlertTriangle className="inline h-3 w-3 mr-1" />}
                    {incident.notification_deadline
                      ? `Deadline: ${formatDateTime(incident.notification_deadline)}`
                      : "No deadline set"}
                    {incident.notification_deadline && (
                      <span className="block">{notifDeadline.text}</span>
                    )}
                  </p>
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm font-medium">48-Hour Report</p>
                </div>
                {incident.report_submitted_at ? (
                  <p className="mt-1 text-sm text-emerald-600">
                    Submitted at {formatDateTime(incident.report_submitted_at)}
                  </p>
                ) : (
                  <p className={`mt-1 text-sm ${reportDeadline.overdue ? "text-red-500 font-medium" : "text-muted-foreground"}`}>
                    {reportDeadline.overdue && <AlertTriangle className="inline h-3 w-3 mr-1" />}
                    {incident.report_deadline
                      ? `Deadline: ${formatDateTime(incident.report_deadline)}`
                      : "No deadline set"}
                    {incident.report_deadline && (
                      <span className="block">{reportDeadline.text}</span>
                    )}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Metadata Card */}
          <Card>
            <CardHeader>
              <CardTitle>Metadata</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">Incident ID</p>
                <p className="font-mono text-sm">{incident.id}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Created</p>
                <p className="text-sm">{formatDateTime(incident.created_at)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Last Updated</p>
                <p className="text-sm">{formatDateTime(incident.updated_at)}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Submit Report Dialog */}
      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="max-w-[700px]">
          <DialogHeader>
            <DialogTitle>Submit 48-Hour Detailed Report</DialogTitle>
            <DialogDescription>
              PVARA requires a detailed incident report within 48 hours of detection.
              Complete all fields below.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 px-5 py-4 max-h-[50vh] overflow-y-auto">
            <div>
              <Label>Nature and Scope</Label>
              <textarea
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                rows={3}
                value={reportForm.nature_and_scope}
                onChange={(e) => setReportForm({ ...reportForm, nature_and_scope: e.target.value })}
                placeholder="Describe the nature and scope of the incident..."
              />
            </div>
            <div>
              <Label>Timeline of Events</Label>
              <textarea
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                rows={3}
                value={reportForm.timeline_of_events}
                onChange={(e) => setReportForm({ ...reportForm, timeline_of_events: e.target.value })}
                placeholder="Chronological timeline of events..."
              />
            </div>
            <div>
              <Label>Affected Data or Systems</Label>
              <textarea
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                rows={3}
                value={reportForm.affected_data_or_systems}
                onChange={(e) => setReportForm({ ...reportForm, affected_data_or_systems: e.target.value })}
                placeholder="What data or systems were affected..."
              />
            </div>
            <div>
              <Label>Containment Actions</Label>
              <textarea
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                rows={3}
                value={reportForm.containment_actions}
                onChange={(e) => setReportForm({ ...reportForm, containment_actions: e.target.value })}
                placeholder="Actions taken to contain the incident..."
              />
            </div>
            <div>
              <Label>Root Cause Analysis</Label>
              <textarea
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                rows={3}
                value={reportForm.root_cause_analysis}
                onChange={(e) => setReportForm({ ...reportForm, root_cause_analysis: e.target.value })}
                placeholder="Root cause analysis findings..."
              />
            </div>
            <div>
              <Label>Remediation Steps</Label>
              <textarea
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                rows={3}
                value={reportForm.remediation_steps}
                onChange={(e) => setReportForm({ ...reportForm, remediation_steps: e.target.value })}
                placeholder="Steps taken to remediate the issue..."
              />
            </div>
            <div>
              <Label>Prevention Measures</Label>
              <textarea
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                rows={3}
                value={reportForm.prevention_measures}
                onChange={(e) => setReportForm({ ...reportForm, prevention_measures: e.target.value })}
                placeholder="Measures to prevent recurrence..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReportOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmitReport} disabled={submittingReport}>
              {submittingReport ? "Submitting..." : "Submit Report"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Resolve Dialog */}
      <Dialog open={resolveOpen} onOpenChange={setResolveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve Incident</DialogTitle>
            <DialogDescription>
              Mark this incident as resolved. Optionally add resolution notes.
            </DialogDescription>
          </DialogHeader>
          <div className="px-5 py-4">
            <Label>Resolution Notes (optional)</Label>
            <textarea
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              rows={4}
              value={resolutionNotes}
              onChange={(e) => setResolutionNotes(e.target.value)}
              placeholder="Summary of how the incident was resolved..."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleResolve} disabled={resolving}>
              {resolving ? "Resolving..." : "Resolve Incident"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Incident</DialogTitle>
            <DialogDescription>Update incident details.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 px-5 py-4">
            <div>
              <Label>Title</Label>
              <Input
                className="mt-1"
                value={editForm.title}
                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
              />
            </div>
            <div>
              <Label>Description</Label>
              <textarea
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                rows={3}
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
              />
            </div>
            <div>
              <Label>Affected Systems</Label>
              <textarea
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                rows={2}
                value={editForm.affected_systems}
                onChange={(e) => setEditForm({ ...editForm, affected_systems: e.target.value })}
              />
            </div>
            <div>
              <Label>Affected Customers Count</Label>
              <Input
                className="mt-1"
                type="number"
                min={0}
                value={editForm.affected_customers_count}
                onChange={(e) =>
                  setEditForm({ ...editForm, affected_customers_count: parseInt(e.target.value) || 0 })
                }
              />
            </div>
            <div>
              <Label>Containment Steps</Label>
              <textarea
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                rows={2}
                value={editForm.containment_steps}
                onChange={(e) => setEditForm({ ...editForm, containment_steps: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEdit} disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
