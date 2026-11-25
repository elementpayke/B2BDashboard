"use client";
import * as React from "react";
import MbokaMark from "@/components/brand/MbokaMark";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { TickMark } from "./parts";
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
  /** Where the money came from, e.g. "USDT · Polygon". */
  sourceLabel: string;
  /** Bank, mobile money provider or network carrying the payout. */
  providerLabel: string;
  explorerUrl?: string | null;
  explorerLabel?: string;
  /** The backend's reason for a failed payment. Falls back to generic copy. */
  failureMessage?: string | null;
  /** What was returned once a refund is confirmed, e.g. "99.50 USDT". */
  refundText?: string | null;
  onClose: () => void;
  onViewTransactions: () => void;
  onViewReceipt: () => void;
  /** Reopens the recipient details so they can be corrected. */
  onFix: () => void;
  onHelp?: () => void;
};

const TITLES: Record<SendStatusKind, string> = {
  sending: "Sending your payment",
  delivered: "All done",
  processing: "Almost there",
  failed: "That didn’t go through",
  refunded: "That didn’t go through",
};

function message(p: SendStatusProps): string {
  const name = p.recipientName || "your recipient";
  const first = p.recipientShort || "your recipient";
  switch (p.status) {
    case "sending":
      return `${p.getsText} to ${name}`;
    case "delivered":
      return `${p.recipientShort || "Your recipient"} received ${p.getsText}.`;
    case "processing":
      return `${p.getsText} is on its way to ${first}. ${p.providerLabel} is still processing it.`;
    case "refunded": {
      const why = p.failureMessage ? `${p.failureMessage} ` : `The payment to ${name} wasn’t delivered. `;
      // A send that converted first is returned in the currency it converted
      // into, so say exactly what came back rather than assuming the original.
      return p.refundText
        ? `${why}Your ${p.refundText} is back in your account.`
        : `${why}Your ${p.totalText} is back in ${p.sourceLabel}.`;
    }
    default:
      return p.failureMessage || `The payment to ${name} wasn’t delivered. Check the details and try again.`;
  }
}

function StatusMark({ status }: { status: SendStatusKind }) {
  if (status === "sending") {
    return (
      <>
        <span aria-hidden className="flex size-28 items-center justify-center rounded-pill bg-accent">
          <MbokaMark size={56} motion="inflight" title={null} />
        </span>
        <span aria-hidden className="flex gap-1.5">
          {[0, 1, 2].map((dot) => (
            <span key={dot} className="size-2 rounded-pill bg-primary motion-safe:animate-pulse" />
          ))}
        </span>
      </>
    );
  }
  if (status === "delivered") {
    return (
      <span
        aria-hidden
        className="mb-2 flex size-28 items-center justify-center rounded-pill bg-primary text-primary-foreground ring-12 ring-accent"
      >
        <TickMark className="size-14" />
      </span>
    );
  }
  const failed = status !== "processing";
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-28 items-center justify-center rounded-pill",
        failed ? "bg-destructive-tint text-destructive-text" : "bg-warning-tint text-warning-text",
      )}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-14"
      >
        {failed ? (
          <>
            <path d="M9 14L4 9l5-5" />
            <path d="M4 9h10a6 6 0 0 1 0 12h-3" />
          </>
        ) : (
          <>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 6.5V12h3.5" />
          </>
        )}
      </svg>
    </span>
  );
}

/**
 * One simple ending for a confirmed payment: a mark, a title, one sentence
 * and at most two actions. The figures were already shown on Check and send;
 * the receipt carries them afterwards.
 */
export default function SendStatus(p: SendStatusProps) {
  const { status } = p;
  const failed = status === "failed" || status === "refunded";
  const ok = status === "delivered" || status === "processing";

  return (
    <section
      data-slot="send-status"
      role="status"
      aria-live="polite"
      className="mx-auto flex w-full max-w-105 flex-col items-center gap-3 rounded-3xl border border-border bg-card px-6 pb-7 pt-11 text-center desktop:px-8"
    >
      <StatusMark status={status} />
      <h1
        id="send-flow-title"
        className="mt-3 font-display text-page-sm font-bold leading-heading tracking-title text-foreground"
      >
        {TITLES[status]}
      </h1>
      <p className="text-title leading-body text-muted-foreground">{message(p)}</p>

      {status === "sending" ? (
        <Button variant="link" className="mt-2" onClick={p.onClose}>
          Close, it keeps going
        </Button>
      ) : null}

      {ok ? (
        <>
          <Button block className="mt-3 rounded-pill" onClick={p.onClose}>
            Done
          </Button>
          <div className="flex flex-wrap items-center justify-center gap-x-4">
            <Button variant="link" onClick={p.onViewReceipt}>
              View receipt
            </Button>
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
        </>
      ) : null}

      {failed ? (
        <>
          <Button block className="mt-3 rounded-pill" onClick={p.onFix}>
            Fix the details
          </Button>
          <div className="flex flex-wrap items-center justify-center gap-x-4">
            <Button variant="link" onClick={p.onClose}>
              Close
            </Button>
            {p.onHelp ? (
              <Button variant="link" onClick={p.onHelp}>
                Get help
              </Button>
            ) : null}
          </div>
        </>
      ) : null}
    </section>
  );
}
