"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { getStoredUser } from "@/lib/auth";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [user, setUser] = useState<ReturnType<typeof getStoredUser>>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Defer auth check to next tick (fixes redirect loop after login)
    const id = setTimeout(() => {
      const u = getStoredUser();
      setUser(u);
      setMounted(true);
      if (!u) {
        router.replace("/login");
        return;
      }
      const isAdmin =
        u.role === "platform_admin" || u.role === "platform_support";
      if (!isAdmin) {
        router.replace("/overview");
      }
    }, 0);
    return () => clearTimeout(id);
  }, [router]);

  if (!mounted || !user) return null;

  const isAdmin =
    user.role === "platform_admin" || user.role === "platform_support";
  if (!isAdmin) return null;

  return (
    <DashboardShell
      user={user}
      tenantName="CIP Platform"
      isAdmin
    >
      {children}
    </DashboardShell>
  );
}
