"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { HelpTooltip } from "@/components/compliance/help-tooltip";
import { apiRequest } from "@/lib/api";
import { toast } from "sonner";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface StrReport {
  id: string;
  type?: string;
  linked_isar_id?: string;
  linkedIsarId?: string;
  status?: string;
  created_at?: string;
  createdAt?: string;
  filename?: string;
}

function norm(r: StrReport) {
  return {
    id: r.id,
    type: r.type ?? "STR",
    linkedIsarId: r.linked_isar_id ?? r.linkedIsarId ?? "",
    status: r.status ?? "filed",
    createdAt: r.created_at ?? r.createdAt ?? "",
    filename: r.filename ?? `str-${r.id}.xml`,
  };
}

type NormStr = ReturnType<typeof norm>;

export default function StrCtrPage() {
  const [reports, setReports] = useState<NormStr[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await apiRequest<StrReport[] | { items: StrReport[] }>("/reports/str");
      const list = Array.isArray(res) ? res : (res as any).items ?? [];
      setReports(list.map(norm));
    } catch (e: any) {
      setError(e.message || "Failed to load reports");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const handleDownloadXml = async (report: NormStr) => {
    setDownloadingId(report.id);
    try {
      const token = localStorage.getItem("cip_access_token");
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/api/v1/reports/str/${report.id}/download`, { headers });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as any)?.error?.message || res.statusText);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = report.filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Downloaded goAML-compliant XML. Submit to FMU portal.");
    } catch (e: any) {
      toast.error(e.message || "Failed to download");
    } finally {
      setDownloadingId(null);
    }
  };

  const handleGenerateStr = async () => {
    setGenerating(true);
    try {
      await apiRequest("/reports/str/generate", { method: "POST" });
      setGenerateOpen(false);
      await fetchReports();
      toast.success("STR report generated successfully.");
    } catch (e: any) {
      toast.error(e.message || "Failed to generate STR");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold inline-flex items-center gap-2">
          STR/CTR Reports
          <HelpTooltip term="STR" />
          <HelpTooltip term="CTR" />
        </h1>
        <p className="text-muted-foreground">
          Suspicious and cash transaction reports for goAML.{" "}
          <Link href="/docs/isar-str" className="text-primary hover:underline">Learn more</Link>
          {" · "}
          <Link href="/docs/goaml-policy" className="text-primary hover:underline">goAML policy</Link>
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <h3 className="font-medium mb-2">How to submit</h3>
          <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-1">
            <li>Download the goAML-compliant XML from the reports below</li>
            <li>Log in to the FMU goAML portal</li>
            <li>Upload the XML file and confirm submission</li>
          </ol>
          <p className="text-sm text-muted-foreground mt-3">
            <strong>Deadline:</strong> STRs must be filed without delay once suspicion is confirmed.
          </p>
          <p className="text-sm mt-2">
            <a href="/docs/goaml-policy" className="text-primary hover:underline">View goAML submission policy</a>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Generated Reports</CardTitle>
            <CardDescription>Reports ready for submission to FMU goAML portal</CardDescription>
          </div>
          <AlertDialog open={generateOpen} onOpenChange={setGenerateOpen}>
            <Button onClick={() => setGenerateOpen(true)} disabled={generating}>
              {generating ? "Generating..." : "Generate STR"}
            </Button>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Generate STR Report</AlertDialogTitle>
                <AlertDialogDescription>
                  This generates a goAML-format XML from all filed ISARs. The XML must be submitted to the FMU's goAML portal within the regulatory deadline.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleGenerateStr} disabled={generating}>
                  {generating ? "Generating..." : "Generate"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardHeader>
        <CardContent>
          {error && (
            <p className="mb-4 text-sm text-destructive">{error}</p>
          )}
          {loading ? (
            <p className="py-8 text-center text-muted-foreground">Loading reports...</p>
          ) : (
            <div className="space-y-4">
              {reports.length === 0 ? (
                <p className="py-8 text-center text-muted-foreground">
                  No STR/CTR reports generated yet. Approve an ISAR and file as STR to generate.
                </p>
              ) : (
                reports.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between rounded-lg border p-4"
                  >
                    <div>
                      <p className="font-medium font-mono">{r.id}</p>
                      <p className="text-sm text-muted-foreground">
                        Type: {r.type} · Linked ISAR: {r.linkedIsarId || "—"} · {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : "—"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="success">{r.status}</Badge>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownloadXml(r)}
                          disabled={downloadingId === r.id}
                          title="Downloads goAML-compliant XML. Submit to FMU portal."
                        >
                          {downloadingId === r.id ? "Downloading..." : "Download XML"}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
