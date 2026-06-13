"use client";

import { useEffect, useState } from "react";
import { getMyUsage } from "@/lib/api";

interface ServiceUsage {
  service_type: string;
  total_usage: number;
  quota_limit: number;
  overage_count: number;
  is_overage_alerted: boolean;
  period_start: string;
  period_end: string;
}

interface UsageDashboard {
  plan_name: string;
  billing_cycle: string;
  period_start: string;
  period_end: string;
  services: ServiceUsage[];
  estimated_cost: number;
}

const SERVICE_LABELS: Record<string, string> = {
  kyc: "KYC Verifications",
  screening: "Screening Checks",
  analytics_l1: "Analytics (Layer 1)",
  analytics_l3: "Analytics (Layer 3 - Commercial)",
  reports: "Compliance Reports",
  form_generation: "Form Generation",
};

export default function BillingPage() {
  const [usage, setUsage] = useState<UsageDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMyUsage()
      .then((data) => setUsage(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold mb-6">Usage & Billing</h1>
        <div className="animate-pulse space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 bg-muted rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (!usage || !usage.services?.length) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold mb-6">Usage & Billing</h1>
        <div className="bg-muted/50 rounded-lg p-8 text-center text-muted-foreground">
          <p>No billing data available yet. Usage will appear here once you start using services.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Usage & Billing</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Plan: <span className="font-medium">{usage.plan_name}</span> &middot;{" "}
            Cycle: <span className="capitalize">{usage.billing_cycle}</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Estimated Cost</p>
          <p className="text-2xl font-bold">PKR {usage.estimated_cost.toLocaleString()}</p>
        </div>
      </div>

      <div className="text-xs text-muted-foreground">
        Period: {new Date(usage.period_start).toLocaleDateString()} —{" "}
        {new Date(usage.period_end).toLocaleDateString()}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {usage.services.map((svc) => {
          const pct = svc.quota_limit > 0 ? Math.min(100, (svc.total_usage / svc.quota_limit) * 100) : 0;
          const isOver = svc.quota_limit > 0 && svc.total_usage > svc.quota_limit;
          return (
            <div key={svc.service_type} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-sm">
                  {SERVICE_LABELS[svc.service_type] || svc.service_type}
                </h3>
                {isOver && (
                  <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                    Over Quota
                  </span>
                )}
              </div>
              <div className="text-2xl font-bold">{svc.total_usage.toLocaleString()}</div>
              {svc.quota_limit > 0 && (
                <>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${isOver ? "bg-amber-500" : pct > 80 ? "bg-yellow-500" : "bg-emerald-500"}`}
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {svc.total_usage} / {svc.quota_limit} calls
                    {svc.overage_count > 0 && ` (${svc.overage_count} overage)`}
                  </p>
                </>
              )}
              {svc.quota_limit === 0 && (
                <p className="text-xs text-muted-foreground">Unlimited</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
