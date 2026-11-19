import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-xs px-2 py-0.5 text-label leading-heading font-bold whitespace-nowrap",
  {
    variants: {
      tone: {
        neutral: "bg-muted text-muted-foreground",
        brand: "bg-accent text-accent-foreground",
        success: "bg-success-tint text-success",
        warning: "bg-warning-tint text-warning-text",
        danger: "bg-destructive-tint text-destructive-text",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export type BadgeProps = React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & {
    /** Leading dot so status is never conveyed by colour alone. Default on. */
    dot?: boolean;
  };

/**
 * Status pill. Map domain statuses to a tone in one place (e.g.
 * lib/services/transactionStatus.ts) rather than choosing colours per screen.
 */
export function Badge({ className, tone, dot = true, children, ...props }: BadgeProps) {
  return (
    <span data-slot="badge" className={cn(badgeVariants({ tone }), className)} {...props}>
      {dot ? <span aria-hidden className="size-1.5 rounded-pill bg-current" /> : null}
      {children}
    </span>
  );
}
