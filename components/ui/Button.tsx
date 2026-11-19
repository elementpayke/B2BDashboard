import * as React from "react";
import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap",
    "font-display font-bold text-sm rounded-md cursor-pointer select-none",
    "transition-[background-color,opacity,box-shadow] duration-150",
    "disabled:cursor-not-allowed disabled:opacity-60 aria-busy:cursor-wait",
    "[&_svg]:size-4 [&_svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        /** One per view: the main action (Send, Confirm, Create). */
        primary: "bg-primary text-primary-foreground hover:opacity-90",
        /** Secondary actions next to a primary one. */
        secondary: "bg-secondary text-secondary-foreground border border-border hover:bg-surface-3",
        /** Low-emphasis actions in toolbars and rows. */
        ghost: "bg-transparent text-foreground hover:bg-muted",
        /** Irreversible actions (Close account, Revoke key). Always confirm first. */
        destructive: "bg-destructive text-primary-foreground hover:opacity-90",
        /** Inline text action (View all, Copy). */
        link: "bg-transparent text-link px-1 hover:underline underline-offset-4",
      },
      size: {
        sm: "h-9 px-3 text-xs",
        /** 44px — the minimum touch target. Default. */
        md: "h-11 px-4",
        lg: "h-12 px-5 text-base",
        icon: "size-11 p-0",
      },
      block: { true: "w-full" },
    },
    compoundVariants: [{ variant: "link", class: "h-auto min-h-11" }],
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    /** Render the child element (e.g. a Next <Link>) with button styling. */
    asChild?: boolean;
    /** Shows a spinner, sets aria-busy and blocks clicks. */
    loading?: boolean;
  };

export function Button({
  className,
  variant,
  size,
  block,
  asChild = false,
  loading = false,
  disabled,
  children,
  type,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, block }), className)}
      disabled={asChild ? undefined : disabled || loading}
      aria-busy={loading || undefined}
      type={asChild ? undefined : (type ?? "button")}
      {...props}
    >
      {asChild ? (
        children
      ) : (
        <>
          {loading ? <Spinner /> : null}
          {children}
        </>
      )}
    </Comp>
  );
}

function Spinner() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className="animate-spin">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.3" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
