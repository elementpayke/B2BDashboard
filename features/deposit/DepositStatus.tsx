"use client";
import * as React from "react";
import MbokaMark from "@/components/brand/MbokaMark";
import { DetailRow, Notice } from "@/components/patterns/flow";
import { Amount } from "@/components/ui/Amount";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { splitMoney } from "@/components/patterns/flow";

export type DepositStatusKind = "waiting-phone" | "waiting-email" | "received" | "failed";

export type DepositStatusProps = {
  kind: DepositStatusKind;
  /** e.g. "13,000.00 KES" — what the payer pays. */
  paidText: string;
  /** e.g. "99.38 USDC" — what lands. Falls back to paidText. */
  receivedText?: string | null;
  /** Account funded, e.g. "USDC wallet · Base". */
  intoLabel: string;
  /** Who was asked to pay: a phone number or an email. */
  payerLabel?: string | null;
  /** Provider, e.g. "M-Pesa" or "Interac". */
  providerLabel: string;
  reference?: string | null;
  referenceLabel?: string;
  failureMessage?: string | null;
  /** EUR/USD/GBP account funded through a stablecoin. */
  convertNote?: { currency: string; status?: string; error?: string } | null;
  onDone: () => void;
  onRetry?: () => void;
  onHelp?: () => void;
};

const COPY: Record<DepositStatusKind, { title: string; badge: string; tone: "warning" | "success" | "danger" }> = {
  "waiting-phone": { title: "Check your phone", badge: "Pending", tone: "warning" },
  "waiting-email": { title: "Check your email", badge: "Pending", tone: "warning" },
  received: { title: "Money received", badge: "Settled", tone: "success" },
  failed: { title: "Not completed", badge: "Failed", tone: "danger" },
};

function Mark({ kind }: { kind: DepositStatusKind }) {
  if (kind === "failed") {
    return (
      <span aria-hidden className="flex size-28 items-center justify-center rounded-pill bg-destructive-tint text-destructive">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="size-11">
          <path d="M7 7l10 10M17 7L7 17" />
        </svg>
      </span>
    );
  }
  const waiting = kind !== "received";
  return (
    <>
      <span aria-hidden className="flex size-28 items-center justify-center rounded-pill bg-accent">
        <MbokaMark size={waiting ? 56 : 64} motion={waiting ? "inflight" : "settlement"} title={null} />
      </span>
      {waiting ? (
        <span aria-hidden className="flex gap-1.5">
          {[0, 1, 2].map((dot) => (
            <span key={dot} className="size-2 rounded-pill bg-primary motion-safe:animate-pulse" />
          ))}
        </span>
      ) : null}
    </>
  );
}

function message(p: DepositStatusProps): React.ReactNode {
  const payer = p.payerLabel ? <span className="font-mono text-foreground">{p.payerLabel}</span> : "your phone";
  switch (p.kind) {
    case "waiting-phone":
      return (
        <>
          We sent a {p.providerLabel} prompt to {payer} for{" "}
          <span className="font-mono text-foreground">{p.paidText}</span>. Enter the PIN to approve it.
        </>
      );
    case "waiting-email":
      return (
        <>
          We sent an Interac request for <span className="font-mono text-foreground">{p.paidText}</span> to{" "}
          {p.payerLabel || "your email"}. Accept it from your bank to fund your account.
        </>
      );
    case "received":
      return <>It’s in your {p.intoLabel} and ready to use.</>;
    default:
      return p.failureMessage || `The ${p.providerLabel} payment wasn’t completed.`;
  }
}

/** The screen after paying: waiting, received or not completed, on one white panel. */
export default function DepositStatus(p: DepositStatusProps) {
  const copy = COPY[p.kind];
  const received = splitMoney(p.receivedText || p.paidText);
  return (
    <div className="flex flex-col items-center gap-5 text-center">
      <section
        aria-label="Top-up status"
        className="flex w-full flex-col items-center gap-4 rounded-3xl border border-border bg-card px-6 pb-4 pt-8 desktop:px-7"
      >
        <Mark kind={p.kind} />
        <Badge tone={copy.tone}>{copy.badge}</Badge>
        <h1
          id="deposit-flow-title"
          className="font-display text-page font-bold leading-heading tracking-display text-foreground desktop:text-hero"
        >
          {copy.title}
        </h1>
        {p.kind === "received" && received ? (
          <Amount value={received.value} currency={received.currency} decimals={received.decimals} direction="in" size="hero" />
        ) : null}
        <p className="text-title leading-body text-muted-foreground">{message(p)}</p>

        {p.kind === "failed" ? (
          <Notice tone="info" role="note">
            If {p.payerLabel ? <span className="font-mono">{p.payerLabel}</span> : "you"} was charged anyway, get help
            with the reference below and we’ll trace it.
          </Notice>
        ) : null}

        {p.convertNote && (p.convertNote.status || p.convertNote.error) ? (
          <Notice tone={p.convertNote.error ? "danger" : "info"} role="status">
            <strong className="block font-semibold">Auto-convert to {p.convertNote.currency}</strong>
            {p.convertNote.status ? <span className="block">{p.convertNote.status}</span> : null}
            {p.convertNote.error ? <span className="block">{p.convertNote.error}</span> : null}
          </Notice>
        ) : null}

        <dl className="w-full divide-y divide-border border-t border-border text-left">
          {p.kind === "received" ? (
            <DetailRow label="You paid">
              <span className="font-mono">{p.paidText}</span>
            </DetailRow>
          ) : null}
          <DetailRow label="From">{[p.providerLabel, p.payerLabel].filter(Boolean).join(" · ")}</DetailRow>
          <DetailRow label="Into">{p.intoLabel}</DetailRow>
          {p.reference ? (
            <DetailRow label={p.referenceLabel || "Reference"}>
              <span className="font-mono">{p.reference}</span>
            </DetailRow>
          ) : null}
        </dl>
      </section>

      {p.kind === "waiting-phone" || p.kind === "waiting-email" ? (
        <p className="text-body text-muted-foreground">
          You can close this. We keep checking and update Transactions.
        </p>
      ) : null}

      <div className="flex flex-wrap justify-center gap-2.5">
        {p.kind === "failed" && p.onRetry ? (
          <>
            <Button variant="secondary" className="rounded-pill px-5" onClick={p.onDone}>
              Close
            </Button>
            <Button className="rounded-pill px-7" onClick={p.onRetry}>
              Try again
            </Button>
          </>
        ) : (
          <Button className="rounded-pill px-8" onClick={p.onDone}>
            Done
          </Button>
        )}
      </div>
      {p.kind === "failed" && p.onHelp ? (
        <Button variant="link" onClick={p.onHelp}>
          Get help
        </Button>
      ) : null}
    </div>
  );
}
