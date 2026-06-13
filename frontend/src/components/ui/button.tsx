import * as React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = {
  variant: {
    default:
      "bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-[0_0_16px_rgba(59,130,246,0.25)] dark:hover:shadow-[0_0_16px_rgba(59,130,246,0.25)]",
    destructive: "bg-destructive/10 text-destructive border border-destructive/15 hover:bg-destructive/20",
    outline: "border border-border bg-transparent text-muted-foreground hover:border-muted-foreground/40 hover:text-foreground hover:bg-accent",
    secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
    ghost: "hover:bg-accent hover:text-accent-foreground",
    link: "text-primary underline-offset-4 hover:underline",
  },
  size: {
    default: "h-auto px-[14px] py-[7px] rounded-md text-[0.78rem]",
    sm: "h-auto px-[10px] py-[5px] rounded-md text-[0.7rem]",
    lg: "h-auto px-6 py-[11px] rounded-md text-[0.85rem]",
    icon: "h-[34px] w-[34px] rounded-md",
  },
};

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof buttonVariants.variant;
  size?: keyof typeof buttonVariants.size;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    return (
      <button
        className={cn(
          "inline-flex items-center justify-center gap-1.5 whitespace-nowrap font-medium ring-offset-background transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-40",
          buttonVariants.variant[variant],
          buttonVariants.size[size],
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button };
