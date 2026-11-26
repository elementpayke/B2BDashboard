"use client";
import { Notice, StepHeading } from "@/components/patterns/flow";
import { Button } from "@/components/ui/Button";
import { CopyButton } from "./BankDetails";
import type { FiatFundingAccount } from "./types";

export type FiatAccountDetailsProps = {
  account: FiatFundingAccount;
  titleId: string;
  onBack?: () => void;
  onDone: () => void;
};

/** Fund a fiat account: its own bank details, each copyable, on one white panel. */
export default function FiatAccountDetails({ account, titleId, onBack, onDone }: FiatAccountDetailsProps) {
  const sections = account.sections.filter((s) => s.rows.length > 0);
  return (
    <>
      <StepHeading
        title={`Fund your ${account.currency} account`}
        titleId={titleId}
        onBack={onBack}
        sub={`Send ${account.currency} from any bank to these details. It lands in your ${account.label}.`}
      />

      {sections.length === 0 ? (
        <Notice tone="info">
          Your {account.label} details aren’t ready yet. We’re setting them up with the bank, so check back
          shortly.
        </Notice>
      ) : (
        <section
          aria-label={`${account.label} details`}
          className="flex flex-col gap-5 rounded-3xl border border-border bg-card px-4 py-5 desktop:px-5"
        >
          {sections.map((section) => (
            <div key={section.title} className="flex flex-col gap-1">
              <h2 className="px-1 font-display text-overline-sm font-bold uppercase tracking-overline text-muted-foreground">
                {section.title}
              </h2>
              <dl className="divide-y divide-border">
                {section.rows.map((row) => (
                  <div key={`${section.title}-${row.label}`} className="flex min-h-16 items-center gap-3 px-1 py-2">
                    <div className="min-w-0 flex-1">
                      <dt className="text-dense text-muted-foreground">{row.label}</dt>
                      <dd className="break-all font-mono text-lead text-foreground">{row.value}</dd>
                    </div>
                    {row.copyValue ? <CopyButton label={row.label} value={row.copyValue} /> : null}
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </section>
      )}

      {account.disclaimer ? (
        <div role="note" className="rounded-xl bg-warning-tint px-4 py-3 text-body leading-body text-warning-text">
          {account.disclaimer}
        </div>
      ) : null}

      <p className="text-body text-muted-foreground">
        Your bank may charge its own fee.
      </p>

      <div className="flex justify-center">
        <Button className="rounded-pill px-8" onClick={onDone}>
          Done
        </Button>
      </div>
    </>
  );
}
