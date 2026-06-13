"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { apiRequest } from "@/lib/api";
import { toast } from "sonner";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface TenantInfo {
  id: string;
  name: string;
  [key: string]: unknown;
}

interface OutsourcingEntry {
  provider_name: string;
  service_description: string;
  status: string;
  [key: string]: unknown;
}

interface FormA5Preview {
  tenant_name?: string;
  entries?: OutsourcingEntry[];
  outsourcing_arrangements?: OutsourcingEntry[];
  [key: string]: unknown;
}

export default function FormA5Page() {
  const [downloading, setDownloading] = useState<"pdf" | "docx" | null>(null);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tenantName, setTenantName] = useState<string>("your organisation");
  const [entries, setEntries] = useState<OutsourcingEntry[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const [tenant, preview] = await Promise.allSettled([
          apiRequest<TenantInfo>("/tenants/me"),
          apiRequest<FormA5Preview>("/reports/form-a5/preview"),
        ]);

        if (tenant.status === "fulfilled" && tenant.value?.name) {
          setTenantName(tenant.value.name);
        }

        if (preview.status === "fulfilled") {
          const data = preview.value;
          const list = data?.entries ?? data?.outsourcing_arrangements ?? [];
          setEntries(Array.isArray(list) ? list : []);
          if (!tenantName && data?.tenant_name) {
            setTenantName(data.tenant_name);
          }
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleDownload = async (format: "pdf" | "docx") => {
    setDownloading(format);
    try {
      const token = localStorage.getItem("cip_access_token");
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const endpoint = format === "docx" ? "download-docx" : "download-pdf";
      const response = await fetch(`${API_BASE}/api/v1/reports/form-a5/${endpoint}`, { headers });
      if (!response.ok) throw new Error("Download failed");

      const blob = await response.blob();
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `form-a5-outsourcing-register.${format}`;
      link.click();
      URL.revokeObjectURL(link.href);
      setDownloadOpen(false);
      toast.success("Downloaded. Include this in your PVARA compliance submission.");
    } catch (e: any) {
      toast.error(e.message || "Download failed");
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Form A5 — Outsourcing Register</h1>
        <p className="text-muted-foreground">
          PVARA Regulation 14, Annex A — Outsourcing Declaration &amp; Register.{" "}
          <Link href="/docs/form-a5" className="text-primary hover:underline">Learn more</Link>
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          PVARA/REG/AML-REG/2025-1 under the Virtual Assets Act 2026
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">
            Form A5 is the Outsourcing Register required by PVARA Regulation 14. It documents all AML/CFT functions outsourced to third-party providers.
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Download and include in your annual compliance submission.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Outsourcing Register</CardTitle>
          <CardDescription>
            Current outsourcing arrangements for {tenantName}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading outsourcing data...</p>
          ) : entries.length > 0 ? (
            entries.map((entry, idx) => (
              <div key={idx} className="rounded-lg border p-4">
                <h3 className="font-medium mb-2">{entry.provider_name}</h3>
                <p className="text-sm text-muted-foreground">
                  {entry.service_description}
                </p>
                <p className="mt-2 text-sm">Status: {entry.status ?? "Active"}</p>
              </div>
            ))
          ) : (
            <div className="rounded-lg border p-4">
              <h3 className="font-medium mb-2">CIP — Compliance Infrastructure Platform</h3>
              <p className="text-sm text-muted-foreground">
                KYC verification, sanctions screening, blockchain analytics, compliance operations.
                Shared RegTech platform per Form A5 / NOC Reg. 14.
              </p>
              <p className="mt-2 text-sm">Status: Active</p>
            </div>
          )}
          <div className="flex gap-3">
            <Button onClick={() => handleDownload("pdf")} disabled={!!downloading}>
              {downloading === "pdf" ? "Generating..." : "Download PDF"}
            </Button>
            <Button variant="outline" onClick={() => handleDownload("docx")} disabled={!!downloading}>
              {downloading === "docx" ? "Generating..." : "Download DOCX"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
