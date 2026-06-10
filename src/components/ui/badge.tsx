import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium tracking-[0.08em] transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-white text-black",
        secondary: "border-white/20 bg-white/[0.08] text-white",
        destructive: "border-red-500/50 bg-red-500/10 text-red-400",
        outline: "border-white/25 text-white",
        success: "border-emerald-500/50 bg-emerald-500/10 text-emerald-400",
        warning: "border-emerald-400/50 bg-emerald-400/10 text-emerald-300 [border-style:dashed]",
        muted: "border-white/10 bg-white/[0.04] text-white/55",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
