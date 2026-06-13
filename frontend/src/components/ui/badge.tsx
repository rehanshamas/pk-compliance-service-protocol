import * as React from "react";

import { cn } from "@/lib/utils";

const badgeVariants = {
  default:
    "border-transparent bg-primary/10 text-primary",
  secondary:
    "border-transparent bg-muted text-muted-foreground",
  destructive:
    "border-transparent bg-red-500/12 text-red-400 dark:text-[#fb7185]",
  outline: "text-foreground border-border",
  success:
    "border-transparent bg-emerald-500/12 text-emerald-600 dark:text-[#4ade80]",
  warning:
    "border-transparent bg-amber-500/10 text-amber-600 dark:text-[#fbbf24]",
  danger:
    "border-transparent bg-red-500/12 text-red-600 dark:text-[#fb7185]",
  info:
    "border-transparent bg-blue-500/12 text-blue-600 dark:text-[#60a5fa]",
  purple:
    "border-transparent bg-purple-500/12 text-purple-600 dark:text-[#a78bfa]",
  teal:
    "border-transparent bg-teal-500/12 text-teal-500 dark:text-[#2dd4a8]",
  orange:
    "border-transparent bg-orange-500/12 text-orange-600 dark:text-[#f97316]",
};

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement> {
  variant?: keyof typeof badgeVariants;
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-[5px] border px-2 py-[2px] text-[0.65rem] font-semibold whitespace-nowrap transition-colors",
        badgeVariants[variant],
        className
      )}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
