"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface FormA6Stats {
  customers_onboarded?: number;
  customersOnboarded?: number;
  screenings_conducted?: number;
  screeningsConducted?: number;
  strs_filed?: number;
  strsFiled?: number;
  training_hours?: number;
  trainingHours?: number;
  [key: string]: unknown;
}

export default function FormA6Page() {
  const [year, setYear] = useState("2026");
  const [downloading, setDownloading] = useState<"pdf" | "docx" | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    customersOnboarded: 0,
    screeningsConducted: 0,
    strsFiled: 0,
    trainingHours: 0,
  });

  const fetchStats = useCallback(async (y: string) => {
    setLoading(true);
    try {
      const data = await apiRequest<FormA6Stats>(`/reports/form-a6/preview?year=${y}`);
      setStats({
        customersOnboarded: data.customers_onboarded ?? data.customersOnboarded ?? 0,
        screeningsConducted: data.screenings_conducted ?? data.screeningsConducted ?? 0,
        strsFiled: data.strs_filed ?? data.strsFiled ?? 0,
        trainingHours: data.training_hours ?? data.trainingHours ?? 0,
      });
    } catch {
      setStats({ customersOnboarded: 0, screeningsConducted: 0, strsFiled: 0, trainingHours: 0 });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats(year);
  }, [year, fetchStats]);

  const handleDownload = async (format: "pdf" | "docx") => {
    setDownloading(format);
    try {
      const token = localStorage.getItem("cip_access_token");
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const endpoint = format === "docx" ? "download-docx" : "download-pdf";
      const response = await fetch(`${API_BASE}/api/v1/reports/form-a6/${endpoint}?year=${year}`, { headers });
      if (!response.ok) throw new Error("Download failed");

      const blob = await response.blob();
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `form-a6-annual-return-${year}.${format}`;
      link.click();
      URL.revokeObjectURL(link.href);
      toast.success("Downloaded. Include this in your PVARA annual compliance submission.");
    } catch (e: any) {
      toast.error(e.message || "Download failed");
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Form A6 — Annual AML/CFT Return</h1>
        <p className="text-muted-foreground">
          PVARA Regulation 18, Annex A — Annual AML/CFT compliance return.{" "}
          <Link href="/docs/form-a6" className="text-primary hover:underline">Learn more</Link>
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          PVARA/REG/AML-REG/2025-1 under the Virtual Assets Act 2026
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">
            Form A6 is the Annual AML/CFT Return required by PVARA Regulation 18. It summarizes your compliance activities for the reporting year.
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Statistics are auto-calculated from your CIP data.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Annual Return</CardTitle>
          <CardDescription>
            Aggregated AML/CFT statistics for the reporting period
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex gap-4 items-end">
            <div>
              <Label htmlFor="year">Reporting Year</Label>
              <Input
                id="year"
                type="number"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="w-24 mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Select the calendar year for the return. Data is pulled from CIP records for January 1 to December 31.
              </p>
            </div>
          </div>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading statistics...</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">Customers Onboarded</p>
                <p className="text-2xl font-semibold">{stats.customersOnboarded}</p>
                <p className="text-xs text-muted-foreground mt-1">Total new KYC customers during the year</p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">Screenings Conducted</p>
                <p className="text-2xl font-semibold">{stats.screeningsConducted}</p>
                <p className="text-xs text-muted-foreground mt-1">All name/entity screenings including re-screenings</p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">STRs Filed</p>
                <p className="text-2xl font-semibold">{stats.strsFiled}</p>
                <p className="text-xs text-muted-foreground mt-1">Suspicious Transaction Reports filed with FMU</p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">AML Training Hours</p>
                <p className="text-2xl font-semibold">{stats.trainingHours}</p>
                <p className="text-xs text-muted-foreground mt-1">Total staff training hours logged</p>
              </div>
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
