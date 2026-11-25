"use client";
import * as React from "react";
import MbokaMark from "@/components/brand/MbokaMark";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { DetailRow, MoneyText, Notice } from "@/components/patterns/flow";
import type { SendOutcome } from "./types";

export type SendStatusKind = "sending" | SendOutcome;

export type SendStatusProps = {
  status: SendStatusKind;
  /** What the recipient gets, e.g. "64600.00 KES". Falls back to what was sent. */
  getsText: string;
  /** What left the account, e.g. "503.00 USDT". */
  totalText: string;
  /** First name or short label for the recipient ("Jane"). Empty when unknown. */
  recipientShort: string;
  recipientName: string;
  /** The account, phone number or address exactly as the payer typed it. */
  recipientAccount?: string | null;
  /** Where the money came from, e.g. "USDT · Polygon". */
  sourceLabel: string;
  /** Asset / network mark shown beside the source. Decorative: the label names it. */
  sourceMark?: React.ReactNode;
  /** Bank, mobile money provider or network carrying the payout. */
  providerLabel: string;
  /** Provider logo shown beside "Sent to …". Decorative: the label names it. */
  providerMark?: React.ReactNode;
  /** Quoted fee and rate, as shown on Check and send. Rows are hidden when unknown. */
  feeText?: string | null;
  rateLine?: string | null;
  /** Mboka's reference for this payment. Copyable when known. */
  reference?: string | null;
  /** When the payment reached its final status (ISO). Shown on the last step. */
  finishedAt?: string | null;
  explorerUrl?: string | null;
  explorerLabel?: string;
  /** The backend's reason for a failed payment, shown as-is when present. */
  failureMessage?: string | null;
  /** What was returned once a refund is confirmed, e.g. "99.50 USDT". */
  refundText?: string | null;
  /** After this long without a final status the screen says it's slow. Default 10 minutes. */
  slowAfterMs?: number;
  onClose: () => void;
  onViewTransactions: () => void;
  onViewReceipt: () => void;
  /** Reopens the payment details so it can be sent again. */
  onFix: () => void;
  onHelp?: () => void;
};

type StepState = "done" | "current" | "failed" | "upcoming";
type Step = { key: string; title: React.ReactNode; detail?: React.ReactNode; at?: string | null; state: StepState };

const SLOW_AFTER_MS = 10 * 60 * 1000;

function clock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

function timeOf(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

/** Time since this screen opened (the moment Send was pressed), ticking until the payment is final. */
function useElapsed(running: boolean): number {
  const [start] = React.useState(() => Date.now());
  const [now, setNow] = React.useState(start);
  React.useEffect(() => {
    if (!running) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [running]);
  return now - start;
}

function Check() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="size-3">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

function Cross() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="size-3">
      <path d="M7 7l10 10M17 7L7 17" />
    </svg>
  );
}

const NODE: Record<StepState, string> = {
  done: "bg-primary text-primary-foreground",
  current: "bg-accent text-primary",
  failed: "bg-destructive-tint text-destructive",
  upcoming: "border-2 border-surface-3",
};

const STATE_WORD: Record<StepState, string> = {
  done: "Done",
  current: "In progress",
  failed: "Failed",
  upcoming: "Not yet",
};

function Timeline({ steps }: { steps: Step[] }) {
  return (
    <ol aria-label="Payment progress" className="flex flex-col">
      {steps.map((step, i) => {
        const last = i === steps.length - 1;
        const next = steps[i + 1];
        return (
          <li key={step.key} className="flex gap-3" aria-current={step.state === "current" ? "step" : undefined}>
            <div className="flex w-5 flex-col items-center">
              <span
                aria-hidden
                className={cn("flex size-5 shrink-0 items-center justify-center rounded-pill", NODE[step.state])}
              >
                {step.state === "done" ? <Check /> : null}
                {step.state === "failed" ? <Cross /> : null}
                {step.state === "current" ? (
                  <span className="size-2 rounded-pill bg-primary motion-safe:animate-pulse" />
                ) : null}
              </span>
              {last ? null : (
                <span
                  aria-hidden
                  className={cn(
                    "min-h-3 w-0.5 flex-1",
                    step.state === "done" && next?.state !== "upcoming" ? "bg-primary" : "bg-surface-3",
                  )}
                />
              )}
            </div>
            <div className={cn("flex min-w-0 flex-1 justify-between gap-3", !last && "pb-3")}>
              <div className="flex min-w-0 flex-col gap-0.5">
                <span
                  className={cn(
                    "text-body-lg font-semibold",
                    step.state === "current" && "font-bold text-link",
                    step.state === "failed" && "font-bold text-destructive-text",
                    step.state === "upcoming" && "text-muted-foreground",
                  )}
                >
                  <span className="sr-only">{STATE_WORD[step.state]}: </span>
                  {step.title}
                </span>
                {step.detail ? <span className="text-dense text-muted-foreground">{step.detail}</span> : null}
              </div>
              {step.at ? (
                <span className="shrink-0 font-mono text-dense tabular-nums text-subtle-foreground">{step.at}</span>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function WithMark({ mark, children }: { mark?: React.ReactNode; children: React.ReactNode }) {
  if (!mark) return <>{children}</>;
  return (
    <span className="inline-flex items-center gap-2">
      <span aria-hidden className="inline-flex shrink-0">
        {mark}
      </span>
      {children}
    </span>
  );
}

function CopyReference({ value }: { value: string }) {
  const [copied, setCopied] = React.useState(false);
  React.useEffect(() => {
    if (!copied) return undefined;
    const timer = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(timer);
  }, [copied]);
  return (
    <span className="inline-flex items-center gap-1">
      <span className="font-mono">{value}</span>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Copy reference"
        className="text-link"
        onClick={() => {
          void navigator.clipboard
            ?.writeText(value)
            .then(() => setCopied(true))
            .catch(() => undefined);
        }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <rect x="9" y="9" width="11" height="11" rx="2" />
          <path d="M5 15V6a2 2 0 0 1 2-2h9" />
        </svg>
      </Button>
      <span role="status" className={cn("text-caption text-link", !copied && "sr-only")}>
        {copied ? "Copied" : ""}
      </span>
    </span>
  );
}

/**
 * Where a confirmed payment stands. The Mboka mark turns while the money is
 * moving and stops once it lands (or comes back); under it, the amount, who
 * it's going to and the number as typed, then the steps so far and the figures.
 */
export default function SendStatus(p: SendStatusProps) {
  const { status } = p;
  const moving = status === "sending" || status === "processing";
  const failed = status === "failed" || status === "refunded";
  const elapsedMs = useElapsed(moving);
  const slow = status === "processing" && elapsedMs >= (p.slowAfterMs ?? SLOW_AFTER_MS);
  const elapsed = clock(elapsedMs);
  const name = p.recipientName || "your recipient";
  const first = p.recipientShort || "your recipient";
  const provider = p.providerLabel || "The provider";
  const finished = timeOf(p.finishedAt);

  const title =
    status === "delivered"
      ? `${p.recipientName || "Your recipient"} received it on ${provider}`
      : failed
        ? `Payment to ${name} didn’t go through`
        : `Sending to ${name} on ${provider}`;

  const badge =
    status === "sending" ? (
      <Badge tone="brand">Sending</Badge>
    ) : status === "processing" ? (
      <Badge tone="warning">
        {slow ? "Taking longer than usual" : "Sent"} · <span className="font-mono tabular-nums">{elapsed}</span>
      </Badge>
    ) : status === "delivered" ? (
      <Badge tone="success">Settled</Badge>
    ) : (
      <Badge tone="danger">{status === "refunded" ? "Refunded" : "Failed"}</Badge>
    );

  const created: Step = {
    key: "created",
    title: "Payment created",
    detail: <WithMark mark={p.sourceMark}>From {p.sourceLabel}</WithMark>,
    state: status === "sending" ? "current" : "done",
  };
  const sentTo = <WithMark mark={p.providerMark}>Sent to {provider}</WithMark>;
  const steps: Step[] = [created];
  if (failed) {
    steps.push({
      key: "failed",
      title: "Didn’t go through",
      detail: "Try again later or contact support",
      at: status === "failed" ? finished : null,
      state: "failed",
    });
    if (status === "refunded") {
      steps.push({
        key: "returned",
        title: "Returned to you",
        detail: `${p.refundText || p.totalText} back in ${p.refundText ? "your account" : p.sourceLabel}`,
        at: finished,
        state: "done",
      });
    }
  } else {
    steps.push({
      key: "sent",
      title: sentTo,
      detail:
        status === "processing"
          ? slow
            ? `Still waiting for ${provider} to confirm`
            : `Waiting for ${provider} to confirm delivery`
          : undefined,
      state: status === "sending" ? "upcoming" : status === "processing" ? "current" : "done",
    });
    steps.push({
      key: "delivered",
      title: `Delivered to ${p.recipientShort || "your recipient"}`,
      detail:
        status === "delivered"
          ? `Confirmed by ${provider}`
          : slow
            ? "Or returned to you if it can’t be delivered"
            : undefined,
      at: status === "delivered" ? finished : null,
      state: status === "delivered" ? "done" : "upcoming",
    });
  }

  const totalLabel = status === "refunded" ? "Returned" : failed ? "Amount" : "Total debited";
  const totalValue = status === "refunded" && p.refundText ? p.refundText : p.totalText;

  return (
    <section
      data-slot="send-status"
      aria-live="polite"
      className="mx-auto flex w-full max-w-120 flex-col overflow-hidden rounded-3xl border border-border bg-card"
    >
      <div className="flex flex-col items-center gap-4 px-6 pb-6 pt-10 text-center">
        <span className="relative inline-flex">
          <MbokaMark
            size={88}
            motion={moving ? "inflight" : status === "delivered" ? "settlement" : "static"}
            spin={moving}
            title={moving ? "Processing" : status === "delivered" ? "Received" : "Mboka"}
          />
          {failed ? (
            <span
              aria-hidden
              className="absolute -bottom-1.5 -right-1.5 flex size-8 items-center justify-center rounded-pill bg-destructive-tint text-destructive ring-3 ring-card"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="size-4">
                <path d="M9 14L4 9l5-5" />
                <path d="M4 9h10a6 6 0 0 1 0 12h-3" />
              </svg>
            </span>
          ) : null}
        </span>

        <div className="flex flex-col items-center gap-1">
          <MoneyText
            text={p.getsText}
            size="hero"
            className={cn(failed && "text-subtle-foreground line-through")}
          />
          <h1
            id="send-flow-title"
            className="font-display text-title font-bold leading-snug tracking-title text-foreground"
          >
            {title}
          </h1>
          {p.recipientAccount ? (
            <span className="break-all font-mono text-lead tabular-nums text-foreground">{p.recipientAccount}</span>
          ) : null}
          {failed ? (
            <p className="mt-1 text-body-lg leading-body text-muted-foreground">
              Please try again later or contact support.
            </p>
          ) : null}
        </div>
        {badge}
      </div>

      <div className="mx-6 border-t border-border py-5">
        <Timeline steps={steps} />
      </div>

      {failed && p.failureMessage ? (
        <div className="mx-6 mb-3">
          <Notice tone="danger" role="note">
            <span className="block text-label font-bold uppercase tracking-label">Reason</span>
            <span className="break-words text-foreground">{p.failureMessage}</span>
          </Notice>
        </div>
      ) : null}

      {slow ? (
        <div className="mx-6 mb-3">
          <Notice tone="warning" role="note">
            <strong className="font-semibold">Don’t send it again.</strong> If {provider} can’t deliver it, the
            money comes back to you.
          </Notice>
        </div>
      ) : null}

      <dl className="mx-6 border-t border-border py-2">
        <DetailRow label={totalLabel}>
          <MoneyText text={totalValue} size="sm" />
        </DetailRow>
        {p.feeText && !failed ? (
          <DetailRow label="Fees">
            <MoneyText text={p.feeText} size="sm" />
          </DetailRow>
        ) : null}
        {p.rateLine && !failed ? (
          <DetailRow label="Rate">
            <span className="font-mono">{p.rateLine}</span>
          </DetailRow>
        ) : null}
        {p.reference ? (
          <DetailRow label="Reference">
            <CopyReference value={p.reference} />
          </DetailRow>
        ) : null}
      </dl>

      <div className="flex flex-col gap-3 px-6 pb-6 pt-3">
        {moving ? (
          <p className="text-center text-dense leading-body text-muted-foreground">
            You can close this. It keeps going, and we’ll tell you when {first} has the money.
          </p>
        ) : null}

        {status === "sending" ? (
          <Button variant="link" className="self-center" onClick={p.onClose}>
            Close, it keeps going
          </Button>
        ) : null}

        {status === "processing" || status === "delivered" ? (
          <Button block onClick={p.onClose}>
            Done
          </Button>
        ) : null}
        {status === "delivered" ? (
          <Button variant="secondary" block onClick={p.onViewReceipt}>
            View receipt
          </Button>
        ) : null}
        {status === "processing" || (p.explorerUrl && !failed && status !== "sending") ? (
          <div className="flex flex-wrap items-center justify-center gap-x-4">
            {status === "processing" ? (
              <Button variant="link" onClick={p.onViewTransactions}>
                Follow it in Transactions
              </Button>
            ) : null}
            {p.explorerUrl ? (
              <Button variant="link" asChild>
                <a href={p.explorerUrl} target="_blank" rel="noopener noreferrer">
                  {p.explorerLabel || "View onchain"} ↗
                </a>
              </Button>
            ) : null}
          </div>
        ) : null}

        {failed ? (
          <>
            <Button block onClick={p.onFix}>
              Try again
            </Button>
            <div className={cn("grid gap-3", p.onHelp ? "grid-cols-2" : "grid-cols-1")}>
              {p.onHelp ? (
                <Button variant="secondary" onClick={p.onHelp}>
                  Contact support
                </Button>
              ) : null}
              <Button variant="secondary" onClick={p.onClose}>
                Close
              </Button>
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}
