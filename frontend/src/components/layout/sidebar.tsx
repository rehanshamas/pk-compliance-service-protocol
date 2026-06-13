"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { apiRequest } from "@/lib/api";
import {
  LayoutDashboard,
  Users,
  Shield,
  Wallet,
  FolderOpen,
  FileText,
  Settings,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Building2,
  BarChart3,
  AlertTriangle,
  Activity,
  Server,
  ClipboardCheck,
  FileBarChart,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type NavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
  children?: { label: string; href: string; visibilityKey?: string }[];
};

type NavSection = {
  label?: string;
  items: NavItem[];
};

const MLRO_NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { label: "Overview", href: "/overview", icon: LayoutDashboard },
    ],
  },
  {
    label: "Compliance",
    items: [
      {
        label: "KYC",
        href: "/kyc",
        icon: Users,
        children: [{ label: "Customers", href: "/kyc/customers" }],
      },
      {
        label: "Screening",
        href: "/screening",
        icon: Shield,
        children: [
          { label: "Results", href: "/screening/results" },
          { label: "Batch Jobs", href: "/screening/batch" },
        ],
      },
      {
        label: "Analytics",
        href: "/analytics",
        icon: Wallet,
        children: [
          { label: "Wallet Checks", href: "/analytics/wallets" },
          { label: "Alerts", href: "/analytics/alerts" },
        ],
      },
      { label: "Incidents", href: "/incidents", icon: AlertTriangle },
    ],
  },
  {
    label: "Investigations",
    items: [
      {
        label: "Cases",
        href: "/cases",
        icon: FolderOpen,
        children: [{ label: "Active Cases", href: "/cases" }],
      },
      {
        label: "Reports",
        href: "/reports",
        icon: FileText,
        children: [
          { label: "ISARs", href: "/reports/isars" },
          { label: "STR/CTR", href: "/reports/str-ctr" },
        ],
      },
    ],
  },
  {
    label: "Regulatory Forms",
    items: [
      {
        label: "Form A5",
        href: "/reports/form-a5",
        icon: ClipboardCheck,
      },
      {
        label: "Form A6",
        href: "/reports/form-a6",
        icon: FileBarChart,
      },
    ],
  },
  {
    label: "Configuration",
    items: [
      {
        label: "Settings",
        href: "/settings",
        icon: Settings,
        children: [
          { label: "Team", href: "/settings/team", visibilityKey: "vasp_settings_team_enabled" },
          { label: "API Keys", href: "/settings/api-keys", visibilityKey: "vasp_settings_api_keys_enabled" },
          { label: "Webhooks", href: "/settings/webhooks", visibilityKey: "vasp_settings_webhooks_enabled" },
          { label: "Screening Config", href: "/settings/screening", visibilityKey: "vasp_settings_screening_enabled" },
          { label: "Monitoring Rules", href: "/settings/monitoring", visibilityKey: "vasp_settings_monitoring_enabled" },
          { label: "Record Retention", href: "/settings/retention", visibilityKey: "vasp_settings_retention_enabled" },
          { label: "Analytics", href: "/settings/analytics", visibilityKey: "vasp_settings_analytics_enabled" },
          { label: "Usage & Billing", href: "/settings/billing", visibilityKey: "vasp_settings_billing_enabled" },
          { label: "API Explorer", href: "/settings/api-explorer", visibilityKey: "vasp_settings_api_explorer_enabled" },
        ],
      },
    ],
  },
];

const ADMIN_NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { label: "Applications", href: "/admin/applications", icon: ClipboardList },
      { label: "Tenants", href: "/admin/tenants", icon: Building2 },
      { label: "Onboarding", href: "/admin/onboarding", icon: Users },
    ],
  },
  {
    label: "Analytics",
    items: [
      { label: "Usage", href: "/admin/usage", icon: BarChart3 },
      { label: "Billing", href: "/admin/billing", icon: Wallet },
    ],
  },
  {
    label: "Operations",
    items: [
      { label: "Pipelines", href: "/admin/pipelines", icon: Activity },
      { label: "Audit Log", href: "/admin/audit", icon: FileText },
    ],
  },
  {
    label: "Platform",
    items: [
      { label: "Settings", href: "/admin/settings", icon: Settings },
      { label: "System", href: "/admin/system", icon: Server },
    ],
  },
];

interface SidebarProps {
  isAdmin?: boolean;
  collapsed?: boolean;
  onToggle?: () => void;
}

export function Sidebar({ isAdmin, collapsed = false, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const [visibility, setVisibility] = useState<Record<string, boolean> | null>(null);

  useEffect(() => {
    if (isAdmin) return;
    apiRequest<Record<string, boolean>>("/tenants/me/settings/visibility")
      .then((res) => {
        const d = (res as any)?.data ?? res;
        setVisibility(typeof d === "object" && d ? d : {});
      })
      .catch(() => setVisibility({}));
  }, [isAdmin]);

  const sections = isAdmin ? ADMIN_NAV_SECTIONS : MLRO_NAV_SECTIONS;

  const filterChildren = (children: { label: string; href: string; visibilityKey?: string }[] | undefined) => {
    if (!children) return undefined;
    if (isAdmin || !visibility) return children;
    return children.filter((c) => {
      if (!c.visibilityKey) return true;
      return visibility[c.visibilityKey] !== false;
    });
  };

  return (
    <aside
      className={cn(
        "flex flex-col border-r border-border bg-card transition-all duration-200 z-40",
        collapsed ? "w-[62px] min-w-[62px]" : "w-60 min-w-60"
      )}
      style={{ height: "100vh" }}
    >
      {/* Logo */}
      <div className="flex h-14 items-center gap-2.5 border-b border-border px-4 shrink-0">
        <div className={cn(
          "flex h-7 w-7 items-center justify-center rounded-[7px] shrink-0",
          isAdmin
            ? "bg-gradient-to-br from-red-500 to-orange-500"
            : "bg-gradient-to-br from-primary to-indigo-500"
        )}>
          <Shield className="h-[15px] w-[15px] text-white" />
        </div>
        {!collapsed && (
          <span className="text-[0.95rem] font-bold tracking-tight whitespace-nowrap">
            {isAdmin ? "CIP Admin" : "CIP"}
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2 px-1.5">
        {sections.map((section, si) => (
          <div key={si} className="mb-1">
            {section.label && !collapsed && (
              <div className="px-3 pt-2.5 pb-1 text-[0.6rem] font-semibold uppercase tracking-[1.2px] text-muted-foreground/50">
                {section.label}
              </div>
            )}
            {section.items.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);

              return (
                <div key={item.href} className="space-y-[1px]">
                  <Link
                    href={(filterChildren(item.children) || item.children)?.[0]?.href || item.href}
                    className={cn(
                      "flex items-center gap-[9px] rounded-md px-3 py-[7px] text-[0.82rem] transition-all duration-150 whitespace-nowrap overflow-hidden my-[1px]",
                      isActive
                        ? "bg-primary/10 text-primary font-semibold nav-active-bar"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    )}
                  >
                    <Icon className="h-[17px] w-[17px] shrink-0" />
                    {!collapsed && <span>{item.label}</span>}
                    {!collapsed && item.badge && item.badge > 0 && (
                      <span className="ml-auto bg-destructive text-white text-[0.58rem] font-bold px-[5px] py-[1px] rounded-full leading-snug">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                  {!collapsed && filterChildren(item.children)?.map((child) => {
                    const isChildActive = pathname === child.href;
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        className={cn(
                          "block ml-[26px] pl-3 py-[3px] text-[0.78rem] rounded-md transition-colors",
                          isChildActive
                            ? "text-primary font-medium"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {child.label}
                      </Link>
                    );
                  })}
                </div>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Collapse toggle */}
      <div className="px-2 py-2 border-t border-border shrink-0">
        <button
          type="button"
          onClick={onToggle}
          className="w-full flex items-center justify-center rounded-md p-1.5 text-muted-foreground/60 transition-all hover:bg-accent hover:text-foreground"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>
    </aside>
  );
}
