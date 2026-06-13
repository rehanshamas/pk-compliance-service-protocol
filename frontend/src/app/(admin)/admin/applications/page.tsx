"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ClipboardList, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { toast } from "sonner";

type Application = {
  id: string;
  company_name: string;
  legal_name: string;
  registration_number: string;
  address: string;
  mlro_name: string;
  mlro_email: string;
  compliance_email: string;
  admin_email: string;
  noc_status: string;
  license_type: string;
  status: string;
  created_at: string;
  reviewer_notes?: string;
};

export default function AdminApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Review dialog state
  const [reviewApp, setReviewApp] = useState<Application | null>(null);
  const [reviewAction, setReviewAction] = useState<"approve" | "reject" | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [createTenant, setCreateTenant] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const fetchApplications = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<{ items: Application[]; total: number }>("/applications");
      setApplications(data.items ?? (Array.isArray(data) ? data : []));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load applications");
      setApplications([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  const pendingCount = applications.filter((a) => a.status === "pending").length;

  const openReviewDialog = (app: Application, action: "approve" | "reject") => {
    setReviewApp(app);
    setReviewAction(action);
    setReviewNotes("");
    setCreateTenant(action === "approve");
  };

  const closeReviewDialog = () => {
    setReviewApp(null);
    setReviewAction(null);
    setReviewNotes("");
    setCreateTenant(true);
    setSubmitting(false);
  };

  const handleReviewSubmit = async () => {
    if (!reviewApp || !reviewAction) return;
    setSubmitting(true);
    try {
      await apiRequest(`/applications/${reviewApp.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          action: reviewAction,
          notes: reviewNotes,
          create_tenant: reviewAction === "approve" && createTenant,
        }),
      });
      toast.success(
        reviewAction === "approve"
          ? `Application approved${createTenant ? " and tenant created" : ""}`
          : "Application rejected"
      );
      closeReviewDialog();
      fetchApplications();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update application");
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Pending Applications</h1>
        <p className="text-muted-foreground">
          VASP applications from the public Apply form. Review and onboard approved applicants.
        </p>
      </div>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Applications</CardTitle>
            <CardDescription>
              {loading
                ? "Loading..."
                : `${applications.length} total, ${pendingCount} pending`}
            </CardDescription>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={fetchApplications} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refresh"}
            </Button>
            <Link
              href="/apply"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              View public Apply form &rarr;
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Loading applications...
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-destructive">{error}</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={fetchApplications}>
                Retry
              </Button>
            </div>
          ) : applications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <ClipboardList className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No applications yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Applications from the public Apply form will appear here.
              </p>
              <Link href="/apply" target="_blank" className="mt-4">
                <Button variant="outline" size="sm">
                  Open Apply form
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {applications.map((app) => (
                <div
                  key={app.id}
                  className="flex items-center justify-between rounded-lg border p-4 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-start gap-4">
                    <ClipboardList className="h-10 w-10 text-muted-foreground shrink-0" />
                    <div>
                      <p className="font-medium">{app.company_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {app.mlro_name} &middot; {app.mlro_email}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        NOC: {app.noc_status || "\u2014"} &middot; License: {app.license_type || "\u2014"} &middot;{" "}
                        {new Date(app.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        app.status === "pending"
                          ? "warning"
                          : app.status === "approved"
                            ? "success"
                            : app.status === "rejected"
                              ? "destructive"
                              : "secondary"
                      }
                    >
                      {app.status}
                    </Badge>
                    {app.status === "pending" && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-emerald-600 hover:text-emerald-700"
                          onClick={() => openReviewDialog(app, "approve")}
                        >
                          <CheckCircle className="mr-1 h-4 w-4" />
                          Approve
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => openReviewDialog(app, "reject")}
                        >
                          <XCircle className="mr-1 h-4 w-4" />
                          Reject
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Review Dialog */}
      <Dialog open={!!reviewApp} onOpenChange={(open) => !open && closeReviewDialog()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {reviewAction === "approve" ? "Approve Application" : "Reject Application"}
            </DialogTitle>
            <DialogDescription>
              {reviewAction === "approve"
                ? `Approve "${reviewApp?.company_name}" and optionally create a tenant account.`
                : `Reject "${reviewApp?.company_name}". The applicant will be notified.`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {reviewApp && (
              <div className="rounded-lg border p-3 space-y-1 text-sm">
                <p><span className="text-muted-foreground">Company:</span> {reviewApp.company_name}</p>
                <p><span className="text-muted-foreground">Legal Name:</span> {reviewApp.legal_name}</p>
                <p><span className="text-muted-foreground">MLRO:</span> {reviewApp.mlro_name} &lt;{reviewApp.mlro_email}&gt;</p>
                <p><span className="text-muted-foreground">Registration:</span> {reviewApp.registration_number}</p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="review-notes">Notes</Label>
              <textarea
                id="review-notes"
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder={
                  reviewAction === "approve"
                    ? "Optional notes (e.g. conditions, follow-up items)"
                    : "Reason for rejection"
                }
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
              />
            </div>
            {reviewAction === "approve" && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={createTenant}
                  onChange={(e) => setCreateTenant(e.target.checked)}
                  className="rounded border-input"
                />
                Create tenant account from application data
              </label>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeReviewDialog} disabled={submitting}>
              Cancel
            </Button>
            <Button
              onClick={handleReviewSubmit}
              disabled={submitting}
              variant={reviewAction === "reject" ? "destructive" : "default"}
            >
              {submitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {reviewAction === "approve" ? "Approve" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
