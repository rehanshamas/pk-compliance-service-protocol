"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Users,
  Shield,
  AlertCircle,
  FileText,
  FolderOpen,
  Wallet,
  AlertTriangle,
  Plus,
  ArrowRight,
  Clock,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Download,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatWidget } from "@/components/charts/stat-widget";
import { HelpTooltip } from "@/components/compliance/help-tooltip";
import { apiRequest } from "@/lib/api";
import { listCustomers } from "@/lib/kyc-api";
import { getStoredUser } from "@/lib/auth";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface OverviewStats {
  totalCustomers: number;
  approvedCustomers: number;
  pendingCustomers: number;
  pendingScreeningHits: number;
  openAlerts: number;
  criticalAlerts: number;
  openCases: number;
  draftISARs: number;
  submittedISARs: number;
  openIncidents: number;
  walletChecks: number;
}

interface RecentAlert {
  id: string;
  severity: string;
  summary: string;
  status: string;
  created_at?: string;
  createdAt?: string;
}

interface RecentCase {
  id: string;
  title: string;
  status: string;
  created_at?: string;
  createdAt?: string;
}

interface RecentISAR {
  id: string;
  status: string;
  suspicion_type?: string;
  suspicionType?: string;
  created_at?: string;
  createdAt?: string;
}

const EMPTY: OverviewStats = {
  totalCustomers: 0,
  approvedCustomers: 0,
  pendingCustomers: 0,
  pendingScreeningHits: 0,
  openAlerts: 0,
  criticalAlerts: 0,
  openCases: 0,
  draftISARs: 0,
  submittedISARs: 0,
  openIncidents: 0,
  walletChecks: 0,
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function severityBadge(s: string) {
  if (s === "critical") return <Badge variant="danger">Critical</Badge>;
  if (s === "high") return <Badge variant="danger">High</Badge>;
  if (s === "medium") return <Badge variant="warning">Medium</Badge>;
  return <Badge variant="success">Low</Badge>;
}

function caseBadge(s: string) {
  if (s === "open") return <Badge variant="warning">Open</Badge>;
  if (s === "investigating") return <Badge variant="info">Investigating</Badge>;
  if (s === "escalated") return <Badge variant="danger">Escalated</Badge>;
  if (s?.startsWith("closed")) return <Badge variant="success">Closed</Badge>;
  return <Badge variant="secondary">{s}</Badge>;
}

function isarBadge(s: string) {
  if (s === "draft") return <Badge variant="secondary">Draft</Badge>;
  if (s === "submitted_for_review") return <Badge variant="warning">Submitted</Badge>;
  if (s === "approved") return <Badge variant="success">Approved</Badge>;
  if (s === "rejected") return <Badge variant="danger">Rejected</Badge>;
  if (s === "filed_as_str") return <Badge variant="info">Filed</Badge>;
  return <Badge variant="secondary">{s}</Badge>;
}

function timeAgo(dateStr?: string): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

/* ------------------------------------------------------------------ */
/*  Quick Action Card                                                  */
/* ------------------------------------------------------------------ */

function QuickAction({
  icon: Icon,
  label,
  description,
  href,
  variant = "default",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description: string;
  href: string;
  variant?: "default" | "warning" | "danger";
}) {
  return (
    <Link href={href}>
      <div
        className={`flex items-center gap-3 rounded-lg border p-3 transition-all hover:-translate-y-[1px] hover:shadow-sm cursor-pointer ${
          variant === "danger"
            ? "border-destructive/30 bg-destructive/5"
            : variant === "warning"
            ? "border-warning/30 bg-warning/5"
            : "border-border bg-card"
        }`}
      >
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${
            variant === "danger"
              ? "bg-destructive/10 text-destructive"
              : variant === "warning"
              ? "bg-amber-500/10 text-amber-500"
              : "bg-primary/10 text-primary"
          }`}
        >
          <Icon className="h-[17px] w-[17px]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[0.82rem] font-medium leading-tight">{label}</p>
          <p className="text-[0.7rem] text-muted-foreground">{description}</p>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0" />
      </div>
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */

export default function OverviewPage() {
  const user = getStoredUser();
  const firstName = user?.fullName?.split(/\s+/)[0] ?? "User";
  const role = user?.role ?? "analyst";

  const [stats, setStats] = useState<OverviewStats>(EMPTY);
  const [recentAlerts, setRecentAlerts] = useState<RecentAlert[]>([]);
  const [recentCases, setRecentCases] = useState<RecentCase[]>([]);
  const [recentISARs, setRecentISARs] = useState<RecentISAR[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const s: OverviewStats = { ...EMPTY };

    const fetches = await Promise.allSettled([
      listCustomers({ limit: 1, offset: 0 }),                                    // 0: total customers
      listCustomers({ limit: 1, offset: 0, status: "approved" }),                 // 1: approved
      listCustomers({ limit: 1, offset: 0, status: "pending" }),                  // 2: pending
      apiRequest<any>("/alerts?limit=5&offset=0&status=open"),                    // 3: open alerts (recent)
      apiRequest<any>("/alerts?limit=1&offset=0&severity=critical&status=open"),  // 4: critical alerts count
      apiRequest<any>("/screening/results?limit=1&offset=0&status=pending"),      // 5: pending screening
      apiRequest<any>("/cases?limit=5&offset=0&status=open"),                     // 6: open cases (recent)
      apiRequest<any>("/isars?limit=5&offset=0&status=draft"),                    // 7: draft ISARs
      apiRequest<any>("/isars?limit=5&offset=0&status=submitted_for_review"),     // 8: submitted ISARs
      apiRequest<any>("/incidents?limit=1&offset=0&status=detected"),             // 9: open incidents
      apiRequest<any>("/wallets?limit=1&offset=0"),                               // 10: wallet checks
    ]);

    const val = (i: number) => {
      if (fetches[i].status !== "fulfilled") return { items: [], total: 0 };
      const d = (fetches[i] as PromiseFulfilledResult<any>).value;
      return { items: d?.items ?? [], total: d?.total ?? d?.meta?.total ?? 0 };
    };

    s.totalCustomers = val(0).total;
    s.approvedCustomers = val(1).total;
    s.pendingCustomers = val(2).total;
    s.openAlerts = val(3).total;
    s.criticalAlerts = val(4).total;
    s.pendingScreeningHits = val(5).total;
    s.openCases = val(6).total;
    s.draftISARs = val(7).total;
    s.submittedISARs = val(8).total;
    s.openIncidents = val(9).total;
    s.walletChecks = val(10).total;

    setRecentAlerts(val(3).items.slice(0, 4));
    setRecentCases(val(6).items.slice(0, 4));
    setRecentISARs([...val(7).items, ...val(8).items].slice(0, 4));
    setStats(s);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const isMLRO = role === "mlro" || role === "compliance_officer";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Welcome back, {firstName}
          </h1>
          <p className="text-muted-foreground">
            Here&apos;s your compliance overview for today.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchAll} disabled={loading}>
          <RefreshCw className={`mr-2 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Urgent banner */}
      {!loading && (stats.criticalAlerts > 0 || stats.openIncidents > 0) && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="py-3 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-destructive">Attention Required</p>
              <p className="text-xs text-muted-foreground">
                {stats.criticalAlerts > 0 && `${stats.criticalAlerts} critical alert${stats.criticalAlerts > 1 ? "s" : ""} open. `}
                {stats.openIncidents > 0 && `${stats.openIncidents} incident${stats.openIncidents > 1 ? "s" : ""} detected — regulatory notification deadline may apply.`}
              </p>
            </div>
            <div className="flex gap-2">
              {stats.criticalAlerts > 0 && (
                <Link href="/analytics/alerts?severity=critical">
                  <Button size="sm" variant="destructive">View Alerts</Button>
                </Link>
              )}
              {stats.openIncidents > 0 && (
                <Link href="/incidents">
                  <Button size="sm" variant="destructive">View Incidents</Button>
                </Link>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stat cards — row 1 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatWidget
          label="Total Customers"
          value={loading ? "—" : stats.totalCustomers}
          subtitle={loading ? "" : `${stats.approvedCustomers} approved · ${stats.pendingCustomers} pending`}
          href="/kyc/customers"
          trend="neutral"
          icon={Users}
        />
        <StatWidget
          label="Screening Hits"
          value={loading ? "—" : stats.pendingScreeningHits}
          subtitle="Pending disposition"
          href="/screening/results?status=pending"
          trend={stats.pendingScreeningHits > 0 ? "up" : "neutral"}
          icon={Shield}
        />
        <StatWidget
          label="Open Alerts"
          value={loading ? "—" : stats.openAlerts}
          subtitle={loading ? "" : `${stats.criticalAlerts} critical`}
          href="/analytics/alerts?status=open"
          trend={stats.criticalAlerts > 0 ? "up" : "neutral"}
          icon={AlertCircle}
        />
        <StatWidget
          label="Open Cases"
          value={loading ? "—" : stats.openCases}
          subtitle="Active investigations"
          href="/cases"
          trend={stats.openCases > 5 ? "up" : "neutral"}
          icon={FolderOpen}
        />
      </div>

      {/* Stat cards — row 2 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatWidget
          label={<span className="inline-flex items-center gap-1">ISARs <HelpTooltip term="ISAR" /></span>}
          value={loading ? "—" : stats.draftISARs + stats.submittedISARs}
          subtitle={loading ? "" : `${stats.draftISARs} draft · ${stats.submittedISARs} awaiting review`}
          href="/reports/isars"
          trend={stats.submittedISARs > 0 ? "up" : "neutral"}
          icon={FileText}
        />
        <StatWidget
          label="Incidents"
          value={loading ? "—" : stats.openIncidents}
          subtitle="Requiring attention"
          href="/incidents"
          trend={stats.openIncidents > 0 ? "up" : "neutral"}
          icon={AlertTriangle}
        />
        <StatWidget
          label="Wallet Checks"
          value={loading ? "—" : stats.walletChecks}
          subtitle="Addresses scored"
          href="/analytics/wallets"
          trend="neutral"
          icon={Wallet}
        />
        <StatWidget
          label="KYC Pipeline"
          value={loading ? "—" : stats.pendingCustomers}
          subtitle="Awaiting verification"
          href="/kyc/customers?status=pending"
          trend={stats.pendingCustomers > 5 ? "up" : "neutral"}
          icon={Clock}
        />
      </div>

      {/* Middle section: Quick Actions + Recent Activity */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Quick Actions */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground/60">Quick Actions</h2>
          <div className="space-y-2">
            <QuickAction
              icon={Plus}
              label="New KYC Customer"
              description="Start onboarding a new customer"
              href="/kyc/customers/new"
            />
            <QuickAction
              icon={Shield}
              label="Run Screening Check"
              description="Screen a name against watchlists"
              href="/screening/results"
            />
            <QuickAction
              icon={Wallet}
              label="Score Wallet Address"
              description="Analyze a blockchain address"
              href="/analytics/wallets"
            />
            {stats.pendingScreeningHits > 0 && (
              <QuickAction
                icon={CheckCircle2}
                label={`Disposition ${stats.pendingScreeningHits} Hit${stats.pendingScreeningHits > 1 ? "s" : ""}`}
                description="Review and resolve screening matches"
                href="/screening/results?status=pending"
                variant="warning"
              />
            )}
            {isMLRO && stats.submittedISARs > 0 && (
              <QuickAction
                icon={FileText}
                label={`Review ${stats.submittedISARs} ISAR${stats.submittedISARs > 1 ? "s" : ""}`}
                description="Approve or reject submitted reports"
                href="/reports/isars?status=submitted_for_review"
                variant="warning"
              />
            )}
            {stats.openIncidents > 0 && (
              <QuickAction
                icon={AlertTriangle}
                label="Handle Incident"
                description="Regulatory notification deadline applies"
                href="/incidents"
                variant="danger"
              />
            )}
            <QuickAction
              icon={FileText}
              label="Create ISAR"
              description="Report suspicious activity (Form A7)"
              href="/reports/isars/new"
            />
            <QuickAction
              icon={Download}
              label="Download Forms"
              description="Form A5 (Outsourcing) · Form A6 (Annual Return)"
              href="/reports/form-a5"
            />
          </div>
        </div>

        {/* Recent Activity Feed */}
        <div className="lg:col-span-3 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground/60">Recent Activity</h2>

          {/* Recent Alerts */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Recent Alerts</CardTitle>
                <Link href="/analytics/alerts" className="text-xs text-primary hover:underline">View all →</Link>
              </div>
            </CardHeader>
            <CardContent>
              {recentAlerts.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">No open alerts</p>
              ) : (
                <div className="space-y-2">
                  {recentAlerts.map((a) => (
                    <Link key={a.id} href={`/analytics/alerts?id=${a.id}`}>
                      <div className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-accent/50 transition-colors">
                        {severityBadge(a.severity)}
                        <span className="text-[0.78rem] flex-1 truncate">{a.summary || "Alert"}</span>
                        <span className="text-[0.65rem] text-muted-foreground/60 shrink-0">
                          {timeAgo(a.created_at || a.createdAt)}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Cases */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Open Cases</CardTitle>
                <Link href="/cases" className="text-xs text-primary hover:underline">View all →</Link>
              </div>
            </CardHeader>
            <CardContent>
              {recentCases.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">No open cases</p>
              ) : (
                <div className="space-y-2">
                  {recentCases.map((c) => (
                    <Link key={c.id} href={`/cases/${c.id}`}>
                      <div className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-accent/50 transition-colors">
                        {caseBadge(c.status)}
                        <span className="text-[0.78rem] flex-1 truncate">{c.title || "Case"}</span>
                        <span className="text-[0.65rem] text-muted-foreground/60 shrink-0">
                          {timeAgo(c.created_at || c.createdAt)}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent ISARs */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">
                  <span className="inline-flex items-center gap-1">ISARs <HelpTooltip term="ISAR" /></span>
                </CardTitle>
                <Link href="/reports/isars" className="text-xs text-primary hover:underline">View all →</Link>
              </div>
            </CardHeader>
            <CardContent>
              {recentISARs.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">No pending ISARs</p>
              ) : (
                <div className="space-y-2">
                  {recentISARs.map((r) => (
                    <Link key={r.id} href={`/reports/isars/${r.id}`}>
                      <div className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-accent/50 transition-colors">
                        {isarBadge(r.status)}
                        <span className="text-[0.78rem] flex-1 truncate">
                          {r.suspicion_type || r.suspicionType || "ISAR"} #{r.id.slice(0, 8)}
                        </span>
                        <span className="text-[0.65rem] text-muted-foreground/60 shrink-0">
                          {timeAgo(r.created_at || r.createdAt)}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Bottom: Regulatory deadlines + compliance health */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              Regulatory Deadlines
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Form A6 — Annual AML/CFT Return</p>
                <p className="text-xs text-muted-foreground">PVARA Regulation 18</p>
              </div>
              <Badge variant="warning">31 Mar 2026</Badge>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Form A5 — Outsourcing Register</p>
                <p className="text-xs text-muted-foreground">PVARA Regulation 14</p>
              </div>
              <Badge variant="secondary">Ongoing</Badge>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">STR Filing</p>
                <p className="text-xs text-muted-foreground">Submit without delay upon suspicion</p>
              </div>
              <Badge variant="secondary">As needed</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              Compliance Health
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {[
              { label: "KYC Coverage", ok: stats.approvedCustomers > 0, detail: `${stats.approvedCustomers}/${stats.totalCustomers} verified` },
              { label: "Screening", ok: stats.pendingScreeningHits === 0, detail: stats.pendingScreeningHits === 0 ? "All clear" : `${stats.pendingScreeningHits} pending` },
              { label: "Cases", ok: stats.openCases === 0, detail: stats.openCases === 0 ? "No open cases" : `${stats.openCases} open` },
              { label: "ISARs", ok: stats.submittedISARs === 0, detail: stats.submittedISARs === 0 ? "None awaiting review" : `${stats.submittedISARs} pending` },
              { label: "Incidents", ok: stats.openIncidents === 0, detail: stats.openIncidents === 0 ? "No active incidents" : `${stats.openIncidents} active` },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-2.5">
                {item.ok ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                ) : (
                  <XCircle className="h-4 w-4 text-amber-500 shrink-0" />
                )}
                <span className="text-[0.78rem] flex-1">{item.label}</span>
                <span className="text-[0.7rem] text-muted-foreground">{item.detail}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <ArrowRight className="h-4 w-4 text-primary" />
              Getting Started
            </CardTitle>
            <CardDescription>Key workflows for your compliance programme</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              { label: "Onboard customers", href: "/kyc/customers/new", done: stats.totalCustomers > 0 },
              { label: "Screen against watchlists", href: "/screening/results", done: stats.pendingScreeningHits >= 0 && stats.totalCustomers > 0 },
              { label: "Score wallet addresses", href: "/analytics/wallets", done: stats.walletChecks > 0 },
              { label: "Review alerts & create cases", href: "/analytics/alerts", done: stats.openCases > 0 },
              { label: "File ISARs for suspicious activity", href: "/reports/isars/new", done: stats.draftISARs > 0 || stats.submittedISARs > 0 },
              { label: "Generate STR for goAML", href: "/reports/str-ctr", done: false },
              { label: "Download Form A5 & A6", href: "/reports/form-a5", done: false },
            ].map((step) => (
              <Link key={step.label} href={step.href}>
                <div className="flex items-center gap-2.5 rounded-md px-2 py-1 hover:bg-accent/50 transition-colors">
                  {step.done ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                  ) : (
                    <div className="h-3.5 w-3.5 rounded-full border-2 border-muted-foreground/30 shrink-0" />
                  )}
                  <span className={`text-[0.78rem] ${step.done ? "text-muted-foreground line-through" : ""}`}>
                    {step.label}
                  </span>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
