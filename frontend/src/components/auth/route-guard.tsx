"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface RouteGuardProps {
  children: React.ReactNode;
  allowedRoles: string[];
}

export function RouteGuard({ children, allowedRoles }: RouteGuardProps) {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    try {
      const userStr = localStorage.getItem("cip_user");
      if (!userStr) {
        router.replace("/login");
        return;
      }
      const user = JSON.parse(userStr);
      if (allowedRoles.includes(user.role)) {
        setAuthorized(true);
      } else {
        router.replace("/overview");
      }
    } catch {
      router.replace("/login");
    }
  }, [allowedRoles, router]);

  if (!authorized) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return <>{children}</>;
}
