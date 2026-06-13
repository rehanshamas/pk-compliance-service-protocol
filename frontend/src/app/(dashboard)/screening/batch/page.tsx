"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiRequest, apiUploadFile } from "@/lib/api";
import { Upload, Download, Loader2 } from "lucide-react";

interface BatchJobItem {
  id: string;
  tenantId: string;
  recordsCount: number;
  status: "queued" | "processing" | "complete" | "failed";
  progressPercent: number;
  processedCount: number;
  startedAt: string | null;
  completedAt: string | null;
  errorMessage: string | null;
  downloadUrl: string | null;
}

function getStatusVariant(
  s: BatchJobItem["status"]
): "default" | "secondary" | "warning" | "destructive" {
  if (s === "complete") return "default";
  if (s === "processing" || s === "queued") return "warning";
  if (s === "failed") return "destructive";
  return "secondary";
}

const POLL_INTERVAL = 3000;

export default function ScreeningBatchPage() {
  const [jobs, setJobs] = useState<BatchJobItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchJobs = async () => {
    try {
      const data = await apiRequest<{ items: BatchJobItem[]; total: number }>("/screening/batch");
      setJobs(data.items || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load jobs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  const hasActiveJobs = jobs.some((j) => j.status === "queued" || j.status === "processing");

  useEffect(() => {
    if (!hasActiveJobs) return;
    const id = setInterval(fetchJobs, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [hasActiveJobs]);

  const handleUploadClick = () => fileInputRef.current?.click();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      await apiUploadFile<BatchJobItem>("/screening/batch", file);
      await fetchJobs();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Batch Screening</h1>
          <p className="text-muted-foreground">
            Upload CSV for bulk sanctions and PEP screening. CSV must have a &quot;name&quot; column (optional: dob, id_number).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleFileChange}
          />
          <Button onClick={handleUploadClick} disabled={uploading}>
            {uploading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            Upload CSV
          </Button>
        </div>
      </div>
      {error && (
        <div className="rounded-md bg-destructive/10 px-4 py-2 text-sm text-destructive">{error}</div>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Batch Jobs</CardTitle>
          <CardDescription>Recent batch screening jobs and status</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 py-8 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading…
            </div>
          ) : jobs.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">No batch jobs yet. Upload a CSV to start.</p>
          ) : (
            <div className="space-y-4">
              {jobs.map((job) => (
                <div
                  key={job.id}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="font-medium">Job {job.id.slice(0, 8)}…</p>
                      <p className="text-sm text-muted-foreground">
                        {job.recordsCount} records
                        {job.startedAt && ` · Started ${new Date(job.startedAt).toLocaleString()}`}
                      </p>
                    </div>
                    <Badge variant={getStatusVariant(job.status)}>{job.status}</Badge>
                    {(job.status === "processing" || job.status === "queued") && (
                      <span className="text-sm text-muted-foreground">{job.progressPercent}%</span>
                    )}
                    {job.status === "failed" && job.errorMessage && (
                      <span className="text-sm text-destructive">{job.errorMessage.slice(0, 80)}</span>
                    )}
                  </div>
                  {job.status === "complete" && job.downloadUrl && (
                    <a
                      href={job.downloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Download Results
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
