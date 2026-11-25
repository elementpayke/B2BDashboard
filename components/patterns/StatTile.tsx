import * as React from "react";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils";

export type StatTileProps = {
  label: React.ReactNode;
  /** Usually an <Amount size="lg" />. */
  value: React.ReactNode;
  /** Secondary line: change vs last period, "as of" time… */
  meta?: React.ReactNode;
  loading?: boolean;
  className?: string;
};

/** KPI tile for Home / Reports rows. Lay out with `grid gap-3 desktop:grid-cols-3`. */
export function StatTile({ label, value, meta, loading, className }: StatTileProps) {
  return (
    <Card className={cn("flex flex-col gap-2 rounded-xl p-4", className)} aria-busy={loading || undefined}>
      <p className="text-label font-bold uppercase tracking-label text-subtle-foreground">{label}</p>
      {loading ? <Skeleton className="h-7 w-32" /> : <div>{value}</div>}
      {meta ? <p className="text-caption text-subtle-foreground">{meta}</p> : null}
    </Card>
  );
}
