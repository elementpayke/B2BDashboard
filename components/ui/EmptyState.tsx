import * as React from "react";
import { cn } from "@/lib/utils";

export type EmptyStateProps = {
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  /** Primary next step, e.g. `<Button>Create account</Button>`. */
  action?: React.ReactNode;
  /** "error" uses role=alert so the failure is announced. */
  tone?: "empty" | "error";
  className?: string;
};

/**
 * Empty / error / fail-closed state for lists and panels. When the API is
 * unavailable we show this — never mock or stale data.
 */
export function EmptyState({ title, description, icon, action, tone = "empty", className }: EmptyStateProps) {
  return (
    <div
      data-slot="empty-state"
      role={tone === "error" ? "alert" : undefined}
      className={cn("flex flex-col items-center gap-2 px-6 py-10 text-center", className)}
    >
      {icon ? (
        <div
          aria-hidden
          className={cn(
            "mb-1 flex size-12 items-center justify-center rounded-pill [&_svg]:size-6",
            tone === "error" ? "bg-destructive-tint text-destructive" : "bg-accent text-accent-foreground",
          )}
        >
          {icon}
        </div>
      ) : null}
      <p className="font-display text-title font-bold text-foreground">{title}</p>
      {description ? <p className="max-w-sm text-body-lg leading-body text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}
