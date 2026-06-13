"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { getStoredUser } from "@/lib/auth";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [user, setUser] = useState<ReturnType<typeof getStoredUser>>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Defer auth check to next tick to avoid redirecting before client has
    // read from localStorage (fixes redirect loop after login)
    const id = setTimeout(() => {
      const u = getStoredUser();
      setUser(u);
      setMounted(true);
      if (!u) {
        router.replace("/login");
      }
    }, 0);
    return () => clearTimeout(id);
  }, [router]);

  if (!mounted || !user) {
    return (
      <div className="flex min-h-screen animate-pulse flex-col">
        <div className="h-14 border-b bg-card" />
        <div className="flex flex-1">
          <div className="w-64 border-r bg-card" />
          <div className="flex-1 space-y-6 p-6">
            <div className="h-8 w-48 rounded bg-muted" />
            <div className="grid gap-4 md:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-24 rounded-lg border bg-card" />
              ))}
            </div>
            <div className="h-64 rounded-lg border bg-card" />
          </div>
        </div>
      </div>
    );
  }

  const isAdmin = user.role === "platform_admin" || user.role === "platform_support";

  return (
    <DashboardShell
      user={user}
      tenantName={user.tenantName}
      isAdmin={isAdmin}
    >
      {children}
    </DashboardShell>
  );
}
