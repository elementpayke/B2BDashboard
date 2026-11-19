"use client";

import * as React from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

/**
 * Accessible modal: focus trap, Esc to close, scroll lock, aria wiring and
 * focus return come from Radix. Centered from the `desktop` breakpoint (900px), bottom sheet below it.
 * Use this instead of hand-rolled `position: fixed` overlays (legacy code has
 * ~13 of those — don't copy them).
 *
 *   <Dialog open={open} onOpenChange={setOpen}>
 *     <DialogContent title="Send money" description="…">…</DialogContent>
 *   </Dialog>
 */
export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export type DialogContentProps = React.ComponentProps<typeof DialogPrimitive.Content> & {
  title: React.ReactNode;
  /** Announced to screen readers; shown under the title unless hideDescription. */
  description?: React.ReactNode;
  hideDescription?: boolean;
  /** Sticky action row (Cancel / Confirm). */
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg";
  /** Hide the × button (e.g. mid-submit). Esc still closes unless prevented. */
  hideClose?: boolean;
};

const SIZES = { sm: "desktop:max-w-sm", md: "desktop:max-w-lg", lg: "desktop:max-w-2xl" } as const;

export function DialogContent({
  title,
  description,
  hideDescription,
  footer,
  size = "md",
  hideClose,
  className,
  children,
  ...props
}: DialogContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-overlay" />
      <DialogPrimitive.Content
        data-slot="dialog"
        // No description → opt out explicitly (silences Radix's a11y warning)
        // without breaking the auto-link when one is given.
        {...(description ? {} : { "aria-describedby": undefined })}
        className={cn(
          "fixed z-50 flex max-h-[92dvh] w-full flex-col bg-popover text-popover-foreground shadow-modal outline-none",
          // mobile: bottom sheet
          "inset-x-0 bottom-0 rounded-t-3xl pb-[env(safe-area-inset-bottom)]",
          // ≥900: centered dialog
          "desktop:inset-auto desktop:top-1/2 desktop:left-1/2 desktop:-translate-x-1/2 desktop:-translate-y-1/2 desktop:rounded-3xl desktop:pb-0",
          SIZES[size],
          className,
        )}
        {...props}
      >
        <header className="flex items-start justify-between gap-3 px-6 pt-6">
          <div className="min-w-0">
            <DialogPrimitive.Title className="font-display text-headline desktop:text-title font-bold tracking-title">
              {title}
            </DialogPrimitive.Title>
            {description ? (
              <DialogPrimitive.Description
                className={cn("mt-1 text-body-lg text-muted-foreground", hideDescription && "sr-only")}
              >
                {description}
              </DialogPrimitive.Description>
            ) : null}
          </div>
          {hideClose ? null : (
            <DialogPrimitive.Close
              aria-label="Close"
              className="-mt-2 -mr-2 inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-pill bg-muted text-muted-foreground hover:text-foreground focus-visible:shadow-focus outline-none"
            >
              <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
              </svg>
            </DialogPrimitive.Close>
          )}
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer ? (
          <footer className="flex flex-col-reverse gap-2 border-t border-border px-6 py-4 desktop:flex-row desktop:justify-end">
            {footer}
          </footer>
        ) : null}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
