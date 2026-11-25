"use client";
import * as React from "react";
import { DetailRow } from "@/components/patterns/flow";
import { Button } from "@/components/ui/Button";
import { copyText } from "@/lib/clipboard";
import type { BankInstructionRow } from "@/lib/services/transferTerms";
import { cn } from "@/lib/utils";

/** Rows already shown elsewhere on the screen (the amount is the headline). */
const HIDDEN = new Set(["amount", "expires"]);

export type BankDetailsProps = {
  /** "13,000.00 KES" */
  payText: string;
  feeText: string;
  rateLine?: string | null;
  receiveText?: string | null;
  arrival: string;
  rows: BankInstructionRow[];
  onSent: () => void;
};

function CopyButton({ label, value }: { label: string; value: string }) {
  const [state, setState] = React.useState<"idle" | "copied" | "failed">("idle");
  React.useEffect(() => {
    if (state === "idle") return;
    const t = window.setTimeout(() => setState("idle"), 1800);
    return () => window.clearTimeout(t);
  }, [state]);
  return (
    <Button
      variant="secondary"
      size="sm"
      className="min-h-11 shrink-0"
      aria-label={state === "copied" ? `${label} copied` : `Copy ${label}`}
      onClick={async () => setState((await copyText(value)) ? "copied" : "failed")}
    >
      {state === "copied" ? "Copied" : state === "failed" ? "Select and copy" : "Copy"}
    </Button>
  );
}

/** After accepting a bank OnRamp quote: the price, then the details to pay to. */
export default function BankDetails(p: BankDetailsProps) {
  const rows = p.rows.filter((r) => !HIDDEN.has(r.k.trim().toLowerCase()));
  return (
    <>
      <div className="flex flex-col gap-2">
        <h1
          id="deposit-flow-title"
          className="font-display text-page font-bold leading-heading tracking-display text-foreground desktop:text-hero"
        >
          Pay to these details
        </h1>
        <p className="text-lead leading-body text-muted-foreground desktop:text-title">
          Send exactly <span className="font-mono text-foreground">{p.payText}</span> from your business bank.
        </p>
      </div>

      <section aria-label="Price breakdown" className="rounded-3xl border border-border bg-card px-5 py-1.5">
        <dl>
          <DetailRow label="You send">
            <span className="font-mono">{p.payText}</span>
          </DetailRow>
          <DetailRow label="Fees · paid by you">
            <span className="font-mono">{p.feeText || "—"}</span>
          </DetailRow>
          {p.rateLine ? (
            <DetailRow label="Rate">
              <span className="font-mono">{p.rateLine}</span>
            </DetailRow>
          ) : null}
          {p.receiveText ? (
            <div className="border-t border-border">
              <DetailRow label="You get" strong>
                <span className="font-mono text-link">{p.receiveText}</span>
              </DetailRow>
            </div>
          ) : null}
          <DetailRow label="Arrives">{p.arrival}</DetailRow>
        </dl>
        <p className="pb-2 text-right text-dense text-muted-foreground">
          Your bank may charge its own fee. Send a different amount and we credit what arrives, less our fee.
        </p>
      </section>

      <dl aria-label="Bank details" className="divide-y divide-border overflow-hidden rounded-3xl border border-border bg-card">
        {rows.length === 0 ? (
          <div className="px-4 py-3 text-body text-muted-foreground">
            <dt className="sr-only">Bank details</dt>
            <dd>Getting the bank details…</dd>
          </div>
        ) : (
          rows.map((row) => {
            const isRef = row.k.trim().toLowerCase() === "reference";
            return (
              <div
                key={row.k}
                className={cn("flex min-h-16 items-center gap-3 px-4 py-2", isRef && "bg-warning-tint")}
              >
                <div className="min-w-0 flex-1">
                  <dt className={cn("text-dense", isRef ? "font-bold text-warning-text" : "text-muted-foreground")}>
                    {isRef ? "Reference · must be included" : row.k}
                  </dt>
                  <dd className="break-all font-mono text-lead text-foreground">{row.v}</dd>
                </div>
                <CopyButton label={row.k} value={row.v} />
              </div>
            );
          })
        )}
      </dl>

      <div role="note" className="rounded-xl bg-warning-tint px-4 py-3 text-body leading-body text-warning-text">
        Without the reference we can’t match your payment, and it can take days to trace.
      </div>

      <div className="flex justify-center">
        <Button className="rounded-pill px-8" onClick={p.onSent}>
          I’ve sent it
        </Button>
      </div>
    </>
  );
}
