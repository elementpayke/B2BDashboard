"use client";
import * as React from "react";
import { TickMark } from "@/components/patterns/flow";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

export type GetStartedChecklistProps = {
  hasAccount: boolean;
  hasMoneyIn: boolean;
  hasMoneyOut: boolean;
  /** Per-business key for remembering "Hide". */
  storageKey: string;
  onOpenAccount: () => void;
  onAddMoney: () => void;
  onSend: () => void;
};

function readHidden(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === "hidden";
  } catch {
    return false;
  }
}

/**
 * After KYB approval: the three steps from a verified business to its first
 * payment, each opening the flow that does it. Disappears when all are done.
 */
export default function GetStartedChecklist(p: GetStartedChecklistProps) {
  const [hidden, setHidden] = React.useState(() => readHidden(p.storageKey));

  const steps = [
    {
      title: "Open a currency account",
      body: "Get USD, EUR or local account details to pay and get paid.",
      done: p.hasAccount,
      cta: "Open account",
      onClick: p.onOpenAccount,
    },
    {
      title: "Add money or get paid",
      body: "Fund the account, or share its details with a buyer.",
      done: p.hasMoneyIn,
      cta: "Add money",
      onClick: p.onAddMoney,
    },
    {
      title: "Send your first payment",
      body: "Pay a supplier by bank, mobile money or stablecoin.",
      done: p.hasMoneyOut,
      cta: "Send money",
      onClick: p.onSend,
    },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  if (hidden || doneCount === steps.length) return null;

  return (
    <section
      data-slot="get-started"
      aria-label="Get started"
      className="rounded-2xl border border-border bg-card px-5 py-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-title font-bold text-foreground">Get started</h2>
          <p className="text-body text-muted-foreground">
            Your business is verified. <span>{`${doneCount} of ${steps.length} done`}</span>
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          aria-label="Hide get started"
          onClick={() => {
            setHidden(true);
            try {
              window.localStorage.setItem(p.storageKey, "hidden");
            } catch {
              // Private mode or blocked storage: hide for this visit only.
            }
          }}
        >
          Hide
        </Button>
      </div>
      <ol className="mt-3 flex flex-col divide-y divide-border">
        {steps.map((s, i) => (
          <li key={s.title} className="flex items-center gap-3 py-3">
            <span
              aria-hidden
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-pill font-display text-body-lg font-bold",
                s.done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
              )}
            >
              {s.done ? <TickMark className="size-4" /> : i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <h3 className={cn("font-display text-lead font-bold", s.done ? "text-muted-foreground" : "text-foreground")}>
                {s.title}
              </h3>
              <p className="text-body text-muted-foreground">{s.body}</p>
            </div>
            {s.done ? (
              <span className="shrink-0 text-body font-semibold text-muted-foreground">Done</span>
            ) : (
              <Button size="sm" variant={steps.findIndex((x) => !x.done) === i ? "primary" : "secondary"} onClick={s.onClick}>
                {s.cta}
              </Button>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
