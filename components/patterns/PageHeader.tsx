import * as React from "react";
import { cn } from "@/lib/utils";

export type PageHeaderProps = {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Right-aligned actions; stacks under the title on mobile. */
  actions?: React.ReactNode;
  className?: string;
};

/** Top of every dashboard screen: one h1, optional description and actions. */
export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <header data-slot="page-header" className={cn("flex flex-col gap-3 desktop:flex-row desktop:items-end desktop:justify-between", className)}>
      <div className="min-w-0">
        <h1 className="font-display text-page-sm desktop:text-page leading-heading font-bold tracking-heading text-foreground">{title}</h1>
        {description ? <p className="mt-1 text-lead text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}
