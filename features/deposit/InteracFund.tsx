"use client";
import * as React from "react";
import { Notice } from "@/components/patterns/flow";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { formatAmount } from "@/components/ui/Amount";
import { usePaymentRequest } from "@/lib/hooks/usePaymentRequest";
import DepositStatus from "./DepositStatus";
import type { InteracAccount } from "./types";

export type InteracFundProps = {
  account: InteracAccount;
  /** Business name, sent as the payer name. */
  payerName: string;
  defaultEmail: string;
  onBack: () => void;
  onDone: () => void;
  onHelp?: () => void;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Fund a CAD account by emailing an Interac e-Transfer request (Mboka payment requests). */
export default function InteracFund(p: InteracFundProps) {
  const pr = usePaymentRequest(p.account.entityId, p.account.id);
  const [amount, setAmount] = React.useState("");
  const [email, setEmail] = React.useState(p.defaultEmail);
  const [note, setNote] = React.useState("");

  const value = Number(amount.replace(/,/g, ""));
  const amountOk = Number.isFinite(value) && value > 0;
  const emailOk = EMAIL_RE.test(email.trim());
  const amountText = amountOk ? `${formatAmount(value, 2)} CAD` : "";

  if (pr.request && pr.stage) {
    return (
      <DepositStatus
        kind={pr.stage === "waiting" ? "waiting-email" : pr.stage}
        paidText={pr.request.amount ? `${formatAmount(pr.request.amount, 2)} ${pr.request.currency || "CAD"}` : amountText}
        intoLabel={p.account.label}
        payerLabel={pr.request.payer?.email || email.trim()}
        providerLabel="Interac"
        reference={pr.request.reference_number}
        referenceLabel="Interac reference"
        failureMessage={pr.request.failure?.code ? `The request ended: ${pr.request.failure.code.replace(/_/g, " ")}.` : "The request expired or was declined."}
        onDone={p.onDone}
        onRetry={pr.stage === "failed" ? pr.reset : undefined}
        onHelp={p.onHelp}
      />
    );
  }

  return (
    <>
      <div className="flex flex-col items-center gap-2 text-center">
        <h1
          id="deposit-flow-title"
          className="font-display text-page font-bold leading-heading tracking-display text-foreground desktop:text-hero"
        >
          Fund by Interac
        </h1>
        <p className="text-lead leading-body text-muted-foreground desktop:text-title">
          Into your {p.account.label}. We email an Interac request to accept from a Canadian bank.
        </p>
      </div>

      <section aria-label="Interac request" className="flex flex-col gap-5 rounded-3xl border border-border bg-card p-5 desktop:p-6">
        <Field label="Amount (CAD)" className="items-center text-center">
          <Input
            className="h-16 border-0 bg-transparent text-center font-display text-hero font-bold tracking-display desktop:text-hero"
            inputMode="decimal"
            placeholder="0.00"
            autoComplete="off"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))}
          />
        </Field>
        <p className="-mt-3 text-center text-body text-muted-foreground">
          Any fee is shown in Transactions once the payment settles.
        </p>
        <div className="border-t border-border pt-5">
          <Field
            label="Send the request to"
            hint="Your email, filled in. Change it if the money comes from someone else."
            error={email.trim() && !emailOk ? "Enter a valid email address." : undefined}
          >
            <Input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
        </div>
        <Field label="Note">
          <Input maxLength={255} placeholder="e.g. March top-up" value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </section>

      {pr.error ? <Notice tone="danger">{pr.error}</Notice> : null}

      <div className="flex justify-center gap-2.5">
        <Button variant="secondary" className="rounded-pill px-5" onClick={p.onBack}>
          <span aria-hidden>←</span> Back
        </Button>
        <Button
          className="rounded-pill px-7"
          disabled={!amountOk || !emailOk}
          loading={pr.sending}
          onClick={() =>
            pr.send({
              method: "interac",
              amount: value.toFixed(2),
              narration: note.trim() || `Fund ${p.account.label}`,
              payer: { name: p.payerName, email: email.trim() },
            })
          }
        >
          Send request
        </Button>
      </div>
    </>
  );
}
