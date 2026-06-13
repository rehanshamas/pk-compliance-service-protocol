"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { ChatAssistant } from "@/components/chat/chat-assistant";
import { clearAuth, type AuthUser } from "@/lib/auth";

interface DashboardShellProps {
  children: React.ReactNode;
  user: AuthUser;
  tenantName: string;
  isAdmin?: boolean;
}

export function DashboardShell({
  children,
  user,
  tenantName,
  isAdmin = false,
}: DashboardShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const router = useRouter();

  const handleLogout = () => {
    clearAuth();
    router.push("/login");
    router.refresh();
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      >
        Skip to main content
      </a>
      <Sidebar
        isAdmin={isAdmin}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          tenantName={tenantName}
          userName={user.fullName}
          userRole={user.role}
          onLogout={handleLogout}
        />
        <main id="main-content" className="flex-1 overflow-y-auto bg-background p-6 [&::-webkit-scrollbar]:w-[5px] [&::-webkit-scrollbar-thumb]:rounded [&::-webkit-scrollbar-thumb]:bg-border" tabIndex={-1}>
          {children}
        </main>
      </div>
      {/* AI Chat Assistant — only for VASP users, not platform admins */}
      {!isAdmin && <ChatAssistant />}
    </div>
  );
}
