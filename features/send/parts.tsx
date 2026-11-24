"use client";
import * as React from "react";
import { Amount } from "@/components/ui/Amount";
import { cn } from "@/lib/utils";

/** "1,234.50 KES" → { value: "1234.50", currency: "KES", decimals: 2 }. Null when it isn't money text. */
export function splitMoney(
  text: string | null | undefined,
): { value: string; currency: string; decimals: number } | null {
  const raw = String(text ?? "").trim();
  const cut = raw.lastIndexOf(" ");
  if (cut <= 0) return null;
  const value = raw.slice(0, cut).replace(/,/g, "").trim();
  const currency = raw.slice(cut + 1).trim();
  if (!value || !currency || !Number.isFinite(Number(value))) return null;
  const fraction = value.includes(".") ? value.length - value.indexOf(".") - 1 : 0;
  return { value, currency, decimals: Math.min(6, Math.max(2, fraction)) };
}

/** Money from a pre-formatted "amount CODE" string; falls back to the raw text in the mono face. */
export function MoneyText({
  text,
  size = "md",
  className,
}: {
  text: string | null | undefined;
  size?: "sm" | "md" | "lg" | "hero";
  className?: string;
}) {
  const money = splitMoney(text);
  if (!money) {
    return (
      <span className={cn("font-mono font-medium tabular-nums", className)}>{text || "—"}</span>
    );
  }
  return (
    <Amount
      value={money.value}
      currency={money.currency}
      decimals={money.decimals}
      size={size}
      className={className}
    />
  );
}

/** Round flag from a CDN url. Decorative — the country is always named beside it. */
export function Flag({ url, className }: { url: string | null | undefined; className?: string }) {
  if (!url) return null;
  return (
    <span
      aria-hidden
      className={cn("inline-block shrink-0 rounded-pill bg-muted bg-cover bg-center shadow-hairline", className)}
      style={{ backgroundImage: `url(${url})` }}
    />
  );
}

export function StepHeading({
  title,
  sub,
  onBack,
  chips,
  centered,
}: {
  title: string;
  sub?: React.ReactNode;
  onBack?: () => void;
  chips?: React.ReactNode;
  centered?: boolean;
}) {
  return (
    <div className={cn("flex flex-col gap-2", centered && "items-center text-center")}>
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 self-start font-display text-body-lg font-bold text-link outline-none focus-visible:shadow-focus"
        >
          <span aria-hidden>←</span> Back
        </button>
      ) : null}
      {chips ? <div className="flex flex-wrap gap-1.5">{chips}</div> : null}
      <h1
        id="send-flow-title"
        className="font-display text-page font-bold leading-heading tracking-display text-foreground desktop:text-hero"
      >
        {title}
      </h1>
      {sub ? <p className="text-lead leading-body text-muted-foreground desktop:text-title">{sub}</p> : null}
    </div>
  );
}

/** A choice already made, with a way back to change it. */
export function ChoiceChip({
  children,
  onChange,
  label,
}: {
  children: React.ReactNode;
  onChange: () => void;
  /** What "Change" changes, for screen readers. */
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      aria-label={`Change ${label}`}
      className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-pill border border-border bg-card px-3 text-body font-bold text-foreground outline-none focus-visible:shadow-focus"
    >
      {children}
      <span className="text-link">Change</span>
    </button>
  );
}

export function SectionLabel({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <h2
      id={id}
      className="font-display text-dense font-bold uppercase tracking-overline text-muted-foreground"
    >
      {children}
    </h2>
  );
}

export function SearchBox({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex min-h-14 items-center gap-2.5 rounded-xl border border-border bg-card px-3.5 focus-within:border-ring focus-within:shadow-focus">
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        className="size-4 shrink-0 text-muted-foreground"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-3.5-3.5" />
      </svg>
      <input
        type="search"
        aria-label={label}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-w-0 flex-1 border-0 bg-transparent text-title text-foreground outline-none placeholder:text-placeholder"
      />
    </label>
  );
}

/** White rounded group of rows, hairline-separated. */
export function PickList({
  children,
  label,
  labelledBy,
}: {
  children: React.ReactNode;
  label?: string;
  labelledBy?: string;
}) {
  return (
    <ul
      aria-label={label}
      aria-labelledby={labelledBy}
      className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card"
    >
      {children}
    </ul>
  );
}

export function PickRow({
  leading,
  title,
  meta,
  trailing,
  onClick,
  disabled,
  selected,
  hint,
  soon,
}: {
  leading?: React.ReactNode;
  title: React.ReactNode;
  meta?: React.ReactNode;
  trailing?: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  selected?: boolean;
  /** Why the row is disabled. */
  hint?: string;
  /** Not available yet: the row is disabled and badged "Coming soon". */
  soon?: boolean;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled || soon}
        title={disabled ? hint : undefined}
        aria-current={selected ? "true" : undefined}
        className={cn(
          "flex min-h-18 w-full cursor-pointer items-center gap-3.5 px-4 py-3 text-left outline-none",
          "transition-[background-color] duration-150 ease-standard hover:bg-muted focus-visible:shadow-focus",
          "disabled:cursor-not-allowed",
          disabled && !soon && "opacity-60",
          selected && "bg-accent",
        )}
      >
        {leading ? <span className="flex shrink-0 items-center">{leading}</span> : null}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-title font-bold leading-snug text-foreground">{title}</span>
          {meta ? (
            <span className="block truncate text-body-lg leading-snug text-muted-foreground">{meta}</span>
          ) : null}
        </span>
        {soon ? (
          <span className="shrink-0 rounded-pill bg-muted px-2.5 py-1 text-dense font-bold text-muted-foreground">
            Coming soon
          </span>
        ) : (
          <>
            {trailing}
            <span aria-hidden className="text-title text-subtle-foreground">
              ›
            </span>
          </>
        )}
      </button>
    </li>
  );
}

/** Initials avatar for a recipient or a provider with no brand mark. */
export function Initials({ name, square, small }: { name: string; square?: boolean; small?: boolean }) {
  const letters =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w.charAt(0).toUpperCase())
      .join("") || "?";
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center bg-accent font-display font-bold text-accent-foreground",
        small ? "size-8 text-dense" : "size-11 text-lead",
        square ? "rounded-md" : "rounded-pill",
      )}
    >
      {letters}
    </span>
  );
}

export function DetailRow({
  label,
  children,
  strong,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
  strong?: boolean;
}) {
  return (
    <div className="flex min-h-10 items-center justify-between gap-4 py-1.5 text-body-lg">
      <dt className={cn(strong ? "font-semibold text-foreground" : "text-muted-foreground")}>{label}</dt>
      <dd className={cn("min-w-0 text-right text-foreground", strong && "font-semibold")}>{children}</dd>
    </div>
  );
}

const NOTICE_TONES = {
  danger: "bg-destructive-tint text-destructive-text",
  warning: "bg-warning-tint text-warning-text",
  info: "bg-accent text-accent-foreground",
} as const;

export function Notice({
  tone,
  role = "alert",
  id,
  children,
}: {
  tone: keyof typeof NOTICE_TONES;
  role?: "alert" | "status" | "note";
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      id={id}
      role={role}
      className={cn("rounded-xl px-4 py-3 text-body-lg leading-body", NOTICE_TONES[tone])}
    >
      {children}
    </div>
  );
}

/** Indigo tick in a circle — Mboka's success mark (indigo, never green). */
export function TickMark({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

/** Two-tone glyph in an indigo tile, for a method with no single brand (Phosphor duotone paths). */
export function GlyphTile({ back, front }: { back: string; front: string }) {
  return (
    <span
      aria-hidden
      className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground"
    >
      <svg viewBox="0 0 256 256" fill="currentColor" className="size-6">
        <path d={back} opacity="0.25" />
        <path d={front} />
      </svg>
    </span>
  );
}

/** Brand logo tile from /public/brand. Decorative — the brand is always named beside it. */
export function LogoTile({ src, small }: { src: string; small?: boolean }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- small local brand marks
    <img
      src={src}
      alt=""
      className={cn(
        "shrink-0 bg-card object-cover shadow-hairline",
        small ? "size-6.5 rounded-sm" : "size-11 rounded-xl",
      )}
    />
  );
}
