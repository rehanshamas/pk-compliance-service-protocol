import Link from "next/link";
import { cn } from "@/lib/utils";

type Trend = "up" | "down" | "neutral";

interface StatWidgetProps {
  label: React.ReactNode;
  value: number | string;
  subtitle?: string;
  href?: string;
  trend?: Trend;
  icon?: React.ComponentType<{ className?: string }>;
  className?: string;
}

export function StatWidget({
  label,
  value,
  subtitle,
  href,
  trend = "neutral",
  icon: Icon,
  className,
}: StatWidgetProps) {
  const content = (
    <div className="p-4">
      <div className="flex items-center justify-between mb-2.5">
        {Icon && (
          <div className={cn(
            "flex h-[34px] w-[34px] items-center justify-center rounded-md",
            trend === "up" && "bg-red-500/12 text-red-400",
            trend === "down" && "bg-emerald-500/12 text-emerald-400",
            trend === "neutral" && "bg-primary/10 text-primary",
          )}>
            <Icon className="h-[17px] w-[17px]" />
          </div>
        )}
        {trend !== "neutral" && (
          <span
            className={cn(
              "text-[0.65rem] font-semibold px-[5px] py-[2px] rounded",
              trend === "up" && "text-red-400 bg-red-500/12",
              trend === "down" && "text-emerald-400 bg-emerald-500/12",
            )}
          >
            {trend === "up" ? "↑" : "↓"}
          </span>
        )}
      </div>
      <p className="text-[1.6rem] font-bold tracking-tight leading-none">{value}</p>
      <p className="text-[0.72rem] text-muted-foreground mt-[3px]">{label}</p>
      {subtitle && (
        <p className="text-[0.64rem] text-muted-foreground/70 mt-1.5 flex items-center gap-1">{subtitle}</p>
      )}
    </div>
  );

  const cardClasses = cn(
    "rounded-[14px] border border-border bg-card overflow-hidden transition-all duration-150",
    href && "hover:border-border/80 cursor-pointer",
    "hover:-translate-y-[1px]",
    className
  );

  if (href) {
    return (
      <Link href={href}>
        <div className={cardClasses}>{content}</div>
      </Link>
    );
  }

  return <div className={cardClasses}>{content}</div>;
}
