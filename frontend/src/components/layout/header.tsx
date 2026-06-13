"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, LogOut, AlertCircle, FileText, Calendar, FolderOpen, Sun, Moon, Search, Users, Wallet, Shield } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/api";
import type { Notification, SearchResult } from "@/lib/types";

interface HeaderProps {
  tenantName?: string;
  userName?: string;
  userRole?: string;
  onLogout?: () => void;
}

const NOTIFICATION_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  alert: AlertCircle,
  new_alert: AlertCircle,
  isar_pending_review: FileText,
  deadline_approaching: Calendar,
  case_sla: FolderOpen,
  system: AlertCircle,
};

const SEARCH_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  customer: Users,
  wallet: Wallet,
  case: FolderOpen,
  isar: FileText,
  alert: Shield,
};

function getNotificationLink(link?: string, isAdmin?: boolean): string {
  if (!link) return "/overview";
  if (link.startsWith("/cases")) return link;
  if (link.startsWith("/reports")) return link;
  return link;
}

export function Header({
  tenantName = "Demo VASP",
  userName = "Demo User",
  userRole = "MLRO",
  onLogout,
}: HeaderProps) {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const isAdmin = userRole === "platform_admin" || userRole === "platform_support";
  const initials = userName.split(/\s+/).map(w => w[0]).join("").slice(0, 2).toUpperCase();

  // --- Notifications (live from API) ---
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await apiRequest<any>("/notifications?limit=10");
      const items: Notification[] = (res.items || res || []).map((n: any) => ({
        id: n.id,
        type: n.type,
        message: n.message,
        link: n.link,
        read: n.read,
        timestamp: n.created_at || n.timestamp,
      }));
      setNotifications(items);
      setUnreadCount(items.filter((n) => !n.read).length);
    } catch {
      // Not critical — keep empty
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000); // poll every 30s
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const handleMarkAllRead = async () => {
    try {
      await apiRequest("/notifications/mark-read", { method: "POST", body: JSON.stringify({ ids: null }) });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {
      // Fallback: just mark locally
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    }
  };

  const handleMarkRead = async (id: string) => {
    try {
      await apiRequest("/notifications/mark-read", { method: "POST", body: JSON.stringify({ ids: [id] }) });
      setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch { /* ignore */ }
  };

  // --- Search ---
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ⌘K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchRef.current?.focus();
        setSearchOpen(true);
      }
      if (e.key === "Escape") {
        setSearchOpen(false);
        searchRef.current?.blur();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Debounced search
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (!value.trim()) {
      setSearchResults([]);
      setSearchOpen(false);
      return;
    }
    setSearchOpen(true);
    setSearchLoading(true);
    searchTimerRef.current = setTimeout(async () => {
      const results: SearchResult[] = [];
      try {
        const [customers, wallets, cases] = await Promise.allSettled([
          apiRequest<any>(`/customers?limit=5&offset=0&search=${encodeURIComponent(value)}`),
          apiRequest<any>(`/wallets?limit=5&search=${encodeURIComponent(value)}`),
          apiRequest<any>(`/cases?limit=5&search=${encodeURIComponent(value)}`),
        ]);
        if (customers.status === "fulfilled") {
          const items = customers.value?.items || customers.value || [];
          for (const c of items.slice(0, 3)) {
            results.push({
              type: "customer",
              id: c.id,
              title: c.fullName || c.full_name,
              subtitle: c.cnicNumber || c.cnic_number,
              href: `/kyc/customers/${c.id}`,
            });
          }
        }
        if (wallets.status === "fulfilled") {
          const items = wallets.value?.items || wallets.value || [];
          for (const w of items.slice(0, 3)) {
            results.push({
              type: "wallet",
              id: w.address,
              title: w.address,
              subtitle: `${w.chain} — Risk: ${w.riskCategory || w.risk_category || "unknown"}`,
              href: `/analytics/wallets/${w.address}`,
            });
          }
        }
        if (cases.status === "fulfilled") {
          const items = cases.value?.items || cases.value || [];
          for (const cs of items.slice(0, 3)) {
            results.push({
              type: "case",
              id: cs.id,
              title: cs.title,
              subtitle: cs.status,
              href: `/cases/${cs.id}`,
            });
          }
        }
      } catch { /* ignore search errors */ }
      setSearchResults(results);
      setSearchLoading(false);
    }, 300);
  };

  const handleSearchSelect = (result: SearchResult) => {
    setSearchOpen(false);
    setSearchQuery("");
    router.push(result.href);
  };

  return (
    <header className={cn(
      "flex h-14 items-center gap-3 border-b border-border bg-card px-5 shrink-0",
      isAdmin ? "justify-between" : "grid grid-cols-[1fr_auto_1fr]"
    )}>
      <div className="flex min-w-0 items-center">
        <span className="truncate text-[0.8rem] text-muted-foreground">{tenantName}</span>
      </div>

      {/* Search bar — centered for MLRO only; Admin design has no search */}
      {!isAdmin && (
      <div className="relative">
        <div className="flex items-center gap-1.5 bg-background/50 border border-border rounded-[10px] px-2.5 py-[5px] w-[260px] transition-all focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10">
          <Search className="h-[14px] w-[14px] text-muted-foreground/50 shrink-0" />
          <input
            ref={searchRef}
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            onFocus={() => searchQuery && setSearchOpen(true)}
            onBlur={() => setTimeout(() => setSearchOpen(false), 200)}
            placeholder="Search customers, wallets, cases…"
            className="bg-transparent border-none outline-none text-[0.78rem] text-foreground placeholder:text-muted-foreground/40 w-full"
          />
          <kbd className="font-mono text-[0.55rem] text-muted-foreground/50 bg-accent px-1 py-[2px] rounded border border-border shrink-0">⌘K</kbd>
        </div>
        {/* Search results dropdown */}
        {searchOpen && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-[10px] shadow-[0_20px_60px_rgba(0,0,0,0.4)] overflow-hidden z-50">
            {searchLoading ? (
              <div className="px-3 py-4 text-center text-[0.75rem] text-muted-foreground">Searching…</div>
            ) : searchResults.length === 0 ? (
              <div className="px-3 py-4 text-center text-[0.75rem] text-muted-foreground">
                {searchQuery ? "No results found" : "Type to search…"}
              </div>
            ) : (
              searchResults.map((r) => {
                const Icon = SEARCH_ICONS[r.type] || Search;
                return (
                  <button
                    key={`${r.type}-${r.id}`}
                    type="button"
                    className="flex items-center gap-2.5 w-full px-3 py-2 text-left hover:bg-accent transition-colors"
                    onMouseDown={() => handleSearchSelect(r)}
                  >
                    <Icon className="h-[14px] w-[14px] text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-[0.78rem] truncate">{r.title}</div>
                      {r.subtitle && <div className="text-[0.65rem] text-muted-foreground truncate">{r.subtitle}</div>}
                    </div>
                    <span className="text-[0.6rem] text-muted-foreground/50 uppercase">{r.type}</span>
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>
      )}

      <div className="flex items-center justify-end gap-1">
        {/* Theme toggle */}
        <button
          type="button"
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          className="flex h-[34px] w-[34px] items-center justify-center rounded-md border border-border bg-transparent text-muted-foreground transition-all hover:bg-accent hover:text-foreground"
          aria-label={resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          {resolvedTheme === "dark" ? (
            <Sun className="h-[17px] w-[17px]" />
          ) : (
            <Moon className="h-[17px] w-[17px]" />
          )}
        </button>

        {/* Notifications — live from API */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="relative flex h-[34px] w-[34px] items-center justify-center rounded-md bg-transparent text-muted-foreground transition-all hover:bg-accent hover:text-foreground">
              <Bell className="h-[17px] w-[17px]" />
              {unreadCount > 0 && (
                <span className="absolute top-[5px] right-[5px] h-[7px] w-[7px] rounded-full bg-destructive border-2 border-card" />
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel className="flex items-center justify-between">
              <span>Notifications</span>
              {unreadCount > 0 && (
                <button type="button" onClick={handleMarkAllRead} className="text-xs text-primary hover:underline">
                  Mark all read
                </button>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {notifications.length === 0 ? (
              <div className="px-2 py-6 text-center text-[0.78rem] text-muted-foreground">No notifications</div>
            ) : (
              notifications.slice(0, 8).map((n) => {
                const Icon = NOTIFICATION_ICONS[n.type] ?? AlertCircle;
                const href = getNotificationLink(n.link, isAdmin);
                return (
                  <DropdownMenuItem key={n.id} asChild>
                    <Link
                      href={href}
                      className={`flex items-start gap-3 py-2 ${!n.read ? "bg-muted/50" : ""}`}
                      onClick={() => handleMarkRead(n.id)}
                    >
                      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[0.78rem]">{n.message}</p>
                        <p className="text-[0.65rem] text-muted-foreground">
                          {new Date(n.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </Link>
                  </DropdownMenuItem>
                );
              })
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-md px-1.5 py-1 ml-1 transition-all hover:bg-accent">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent border border-border text-[0.65rem] font-semibold text-muted-foreground">
                {initials}
              </div>
              <div className="text-left leading-tight">
                <div className="text-[0.78rem] font-medium">{userName}</div>
                <div className="text-[0.6rem] text-muted-foreground">{userRole}</div>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
