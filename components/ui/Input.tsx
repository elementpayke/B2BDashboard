import * as React from "react";
import { cn } from "@/lib/utils";

export type InputProps = React.ComponentProps<"input"> & {
  /** Render amounts / account numbers in the mono face with tabular digits. */
  mono?: boolean;
};

/**
 * Text input. 16px font on mobile prevents iOS zoom-on-focus; 48px height
 * meets touch-target guidance. Pair with <Field> for label/hint/error wiring.
 */
export function Input({ className, mono, type = "text", ...props }: InputProps) {
  return (
    <input
      data-slot="input"
      type={type}
      className={cn(
        "h-12 w-full rounded-md border border-input bg-input-background px-3.5",
        // 16px below the desktop breakpoint stops iOS zoom-on-focus.
        "text-title desktop:text-lead text-foreground placeholder:text-placeholder",
        "outline-none transition-[border-color,box-shadow] duration-150 ease-standard",
        "focus-visible:border-ring focus-visible:shadow-focus",
        "aria-invalid:border-destructive",
        "disabled:cursor-not-allowed disabled:opacity-60",
        mono && "font-mono tabular-nums",
        className,
      )}
      {...props}
    />
  );
}
