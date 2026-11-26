"use client";
import * as React from "react";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { KYB_REVIEW_ETA } from "@/lib/services/kyb";

const ACTIONS: Record<string, string> = {
  send: "send money",
  deposit: "add money",
  receive: "get paid",
  bulk: "send bulk payouts",
  payout: "pay out to a bank",
  bookTransfer: "move money between accounts",
  convert: "convert",
  wallets: "open currency accounts",
};

/** "send" → "send money". Unknown gates get a safe generic phrase. */
export function gateActionLabel(name: string): string {
  return ACTIONS[name] ?? "move money";
}

export type KybGateDialogProps = {
  open: boolean;
  /** Raw KYB status: pending, submitted, rejected or expired. */
  status: string;
  /** What the user tried to do, in words: "send money". */
  action: string;
  onStartVerification: () => void;
  onViewStatus: () => void;
  onClose: () => void;
};

/**
 * Shown instead of silently jumping to Verification when a gated action is
 * clicked: says why it's blocked and what happens next.
 */
export default function KybGateDialog(p: KybGateDialogProps) {
  const inReview = p.status === "submitted";
  const copy = inReview
    ? {
        title: "Your business is in review",
        body: `You can ${p.action} once compliance approves your verification. That usually takes ${KYB_REVIEW_ETA}. We’ll update the dashboard when it’s done.`,
        cta: null,
      }
    : p.status === "rejected"
      ? {
          title: "Verification needs a few fixes",
          body: `Compliance asked for changes before you can ${p.action}. Fix only what they flagged, then resubmit.`,
          cta: "Fix and resubmit",
        }
      : p.status === "expired"
        ? {
            title: "Your verification expired",
            body: `Start a fresh verification to ${p.action}. You can save and come back at any point.`,
            cta: "Start again",
          }
        : {
            title: `Verify your business to ${p.action}`,
            body: `We need details about your business, its owners and a few documents. You can save and come back at any point. Review usually takes ${KYB_REVIEW_ETA}.`,
            cta: "Start verification",
          };

  return (
    <Dialog open={p.open} onOpenChange={(open) => (open ? undefined : p.onClose())}>
      <DialogContent
        size="sm"
        title={copy.title}
        footer={
          <>
            <Button variant="secondary" onClick={p.onClose}>
              {inReview ? "OK" : "Not now"}
            </Button>
            {copy.cta ? (
              <Button onClick={p.onStartVerification}>{copy.cta}</Button>
            ) : (
              <Button onClick={p.onViewStatus}>View status</Button>
            )}
          </>
        }
      >
        <p className="text-body-lg leading-body text-muted-foreground">{copy.body}</p>
      </DialogContent>
    </Dialog>
  );
}
