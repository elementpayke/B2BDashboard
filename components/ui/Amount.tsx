import * as React from "react";
import { cn } from "@/lib/utils";

export type AmountProps = {
  /** Numeric value or decimal string from the API (strings keep precision). */
  value: number | string | null | undefined;
  /** ISO code or asset code (KES, USD, USDC…). Rendered after the number. */
  currency: string;
  /** "in" → `+` in the positive colour, "out" → `−`. Omit for balances. */
  direction?: "in" | "out";
  /** Fraction digits. Defaults to 2. */
  decimals?: number;
  size?: "sm" | "md" | "lg" | "hero";
  /** Hide the currency code (when it's shown elsewhere in the row). */
  hideCurrency?: boolean;
  className?: string;
};

const SIZES = {
  /** Table cells, rows. */
  sm: "text-body",
  md: "text-lead",
  /** Stat tiles. */
  lg: "text-stat tracking-title",
  hero: "text-hero leading-tight tracking-display",
} as const;

/** Format a decimal for display: grouping, fixed decimals, no currency. */
export function formatAmount(value: number | string, decimals = 2): string | null {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.abs(n).toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Money, always. Mono face + tabular digits so columns of amounts align, and
 * one place that decides sign, colour and the "—" fallback. Never format
 * money inline in a screen.
 */
export function Amount({
  value,
  currency,
  direction,
  decimals = 2,
  size = "md",
  hideCurrency,
  className,
}: AmountProps) {
  const formatted = value === null || value === undefined || value === "" ? null : formatAmount(value, decimals);
  const sign = formatted && direction === "in" ? "+" : formatted && direction === "out" ? "−" : "";
  return (
    <span
      data-slot="amount"
      className={cn(
        "font-mono font-medium tabular-nums whitespace-nowrap",
        SIZES[size],
        direction === "in" ? "text-positive" : "text-foreground",
        className,
      )}
    >
      {formatted === null ? (
        <span aria-label="Amount unavailable">—</span>
      ) : (
        <>
          {sign}
          {formatted}
          {hideCurrency ? null : <span className="ml-1 text-[0.85em] text-muted-foreground">{currency}</span>}
        </>
      )}
    </span>
  );
}
