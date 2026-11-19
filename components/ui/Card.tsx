import * as React from "react";
import { cn } from "@/lib/utils";

/** Panel surface — the new-code equivalent of `.ep-panel` (radius-2xl, 22px). */
export function Card({ className, ...props }: React.ComponentProps<"section">) {
  return (
    <section
      data-slot="card"
      className={cn("overflow-hidden rounded-2xl border border-border bg-card text-card-foreground", className)}
      {...props}
    />
  );
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Usually a `<Button variant="link">`. */
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex items-start justify-between gap-3 px-5 pt-5", className)}>
      <div className="min-w-0">
        <h2 className="font-display text-title font-bold tracking-title text-foreground">{title}</h2>
        {description ? <p className="mt-0.5 text-body text-muted-foreground">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}

export function CardBody({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("p-5", className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.ComponentProps<"footer">) {
  return (
    <footer
      className={cn("flex items-center justify-end gap-2 border-t border-border px-5 py-4", className)}
      {...props}
    />
  );
}
