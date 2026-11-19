import * as React from "react";
import { cn } from "@/lib/utils";

/** Loading placeholder. Size it with Tailwind (h-4 w-32 …). */
export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  );
}
