"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api";
import { getStoredUser } from "@/lib/auth";
import { MOCK_PIPELINE_HEALTH } from "@/lib/mock-data";

interface PipelineItem {
  source: string;
  status: string;
  lastRunAt: string | null;
  recordsCount: number;
  lastError: string | null;
  nextRunAt?: string | null;
}

function mockToPipelineItem(m: { source: string; lastIngestionAt: string; recordsCount: number; status: string; nextRunAt?: string }): PipelineItem {
  return {
    source: m.source,
    status: m.status,
    lastRunAt: m.lastIngestionAt,
    recordsCount: m.recordsCount,
    lastError: null,
    nextRunAt: m.nextRunAt,
  };
}

export default function AdminPipelinesPage() {
  const [apiData, setApiData] = useState<{ pipelines: PipelineItem[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState<string | null>(null);

  const handleTrigger = async (source: string) => {
    if (!getStoredUser()) return;
    setTriggering(source);
    try {
      await apiRequest<{ status: string; source: string }>(
        `/admin/pipelines/${source.toLowerCase()}/trigger`,
        { method: "POST" }
      );
      // Refetch after a short delay (ingestion takes time)
      setTimeout(() => {
        apiRequest<{ pipelines: PipelineItem[] }>("/admin/pipelines")
          .then(setApiData)
          .catch(() => {});
      }, 3000);
    } catch {
      // Ignore
    } finally {
      setTriggering(null);
    }
  };

  useEffect(() => {
    if (!getStoredUser()) {
      setLoading(false);
      return;
    }
    apiRequest<{ pipelines: PipelineItem[] }>("/admin/pipelines")
      .then(setApiData)
      .catch(() => setApiData(null))
      .finally(() => setLoading(false));
  }, []);

  const pipelines =
    apiData?.pipelines && apiData.pipelines.length > 0
      ? apiData.pipelines
      : MOCK_PIPELINE_HEALTH.map(mockToPipelineItem);

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Pipeline Health</h1>
          <p className="text-muted-foreground">Sanctions list ingestion status</p>
        </div>
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Pipeline Health</h1>
        <p className="text-muted-foreground">Sanctions list ingestion status</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {pipelines.map((p) => (
          <Card key={p.source}>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">{p.source}</CardTitle>
              <Badge
                variant={
                  p.status === "healthy"
                    ? "success"
                    : p.status === "stale" || p.status === "pending"
                      ? "warning"
                      : "destructive"
                }
              >
                {p.status}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Last run: {p.lastRunAt ? new Date(p.lastRunAt).toLocaleString() : "—"}
              </p>
              {p.nextRunAt && (
                <p className="text-sm text-muted-foreground">
                  Next run: {new Date(p.nextRunAt).toLocaleString()}
                </p>
              )}
              <p className="text-sm text-muted-foreground">
                Records: {p.recordsCount.toLocaleString()}
              </p>
              {p.lastError && (
                <p className="text-sm text-destructive">{p.lastError}</p>
              )}
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => handleTrigger(p.source)}
                disabled={!!triggering}
              >
                {triggering === p.source ? "Triggering…" : "Trigger now"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
