"use client";

import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider defaultTheme="system" storageKey="cip-theme">
      <TooltipProvider delayDuration={300}>
        {children}
        <Toaster position="top-center" richColors closeButton />
      </TooltipProvider>
    </ThemeProvider>
  );
}
