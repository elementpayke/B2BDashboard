"use client";
import * as React from "react";
import CoinMark, { isCoinMarkAsset } from "@/components/brand/CoinMark";
import MbokaLogo from "@/components/brand/MbokaLogo";
import { NetworkListIcon } from "@/components/brand/NetworkMark";
import type { ConvertAccountOption, ConvertFlowProps } from "@/components/convert/ConvertFlow";
import { feeDisclosureText } from "@/components/money/FeeDisclosure";
import {
  DetailRow,
  Flag,
  Initials,
  Notice,
  PickList,
  PickRow,
  SearchBox,
  StepHeading,
  TickMark,
} from "@/components/patterns/flow";
import { Amount, formatAmount } from "@/components/ui/Amount";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { describeConversionRate, formatConvertAmount, type ConversionOut } from "@/lib/services/conversions";
import { isQuotableRoute, isStellarLeg, resolveConvertRoute, type ConvertRoute } from "@/lib/services/convertRoutes";
import { CONVERSION_STAGE_LABELS, isTerminalConversionStatus } from "@/lib/services/ledgerConversions";
import { cn } from "@/lib/utils";

export type ConvertComposerProps = ConvertFlowProps & {
  /** The full-screen container, for the parent's focus and Esc handling. */
  containerRef?: React.Ref<HTMLDivElement>;
};

/** Pause after the last keystroke before a live quote is fetched. */
export const AUTO_QUOTE_DELAY_MS = 700;

/** More accounts than this and the picker gets a search box. */
const PICKER_SEARCH_THRESHOLD = 4;

const TITLE_ID = "convert-flow-title";

/** Backend messages are user-safe; this only gives each one a plain title. */
function friendlyError(message: string): { title: string; body: string } {
  const m = (message || "").trim();
  const lower = m.toLowerCase();
  if (!m || lower === "internal server error") {
    return { title: "Couldn’t get a rate", body: "Something went wrong on our side. Try again in a moment." };
  }
  if (lower.includes("can't be converted") || lower.includes("not supported for conversion")) {
    return { title: "Currency not supported", body: m };
  }
  if (lower.includes("isn't switched on")) return { title: "Not available yet", body: m };
  if (lower.includes("insufficient")) return { title: "Not enough balance", body: m };
  if (lower.includes("minimum")) return { title: "Amount too small", body: m };
  if (lower.includes("usdc account") || lower.includes("usdt account") || lower.includes("stablecoin account")) {
    return { title: "Stablecoin account needed", body: m };
  }
  return { title: "Couldn’t convert", body: m };
}

/** "1:30" */
function clock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Arrival in words, only where the route tells us. */
function arrival(route: ConvertRoute, src?: ConvertAccountOption, dst?: ConvertAccountOption): string | null {
  if (route.kind === "book_transfer") return "Moves instantly";
  if (isStellarLeg(src) || isStellarLeg(dst)) return "Takes a few minutes";
  return null;
}

function haystack(a: ConvertAccountOption): string {
  return [a.label, a.currency, a.network, a.balanceLabel].filter(Boolean).join(" ").toLowerCase();
}

function AccountMark({ account, size = 44 }: { account: ConvertAccountOption; size?: 40 | 44 }) {
  const box = size === 40 ? "size-10" : "size-11";
  if (account.flagUrl) return <Flag url={account.flagUrl} className={box} />;
  const coin = account.currency.toUpperCase();
  if (account.network) {
    return (
      <span aria-hidden className={cn("relative flex shrink-0 items-center justify-center", box)}>
        <NetworkListIcon network={account.network} label={account.network} size={size} />
        {isCoinMarkAsset(coin) ? (
          <span className="absolute -bottom-0.5 -right-0.5 flex rounded-pill bg-card p-0.5">
            <CoinMark asset={coin} size={18} title={null} />
          </span>
        ) : null}
      </span>
    );
  }
  if (isCoinMarkAsset(coin)) {
    return (
      <span aria-hidden className="flex shrink-0">
        <CoinMark asset={coin} size={size} title={null} />
      </span>
    );
  }
  return <Initials name={account.label} />;
}

/** The account pill on each side of the composer; opens the picker. */
function AccountPill({
  side,
  account,
  onClick,
}: {
  side: "From" | "To";
  account?: ConvertAccountOption;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={account ? `${side} ${account.label}. Change` : `Choose the account to convert ${side === "From" ? "from" : "into"}`}
      className="inline-flex min-h-12 shrink-0 cursor-pointer items-center gap-2.5 rounded-pill bg-muted py-1 pl-1 pr-3 text-foreground outline-none transition-[background-color] duration-150 ease-standard hover:bg-surface-3 focus-visible:shadow-focus"
    >
      {account ? (
        <AccountMark account={account} size={40} />
      ) : (
        <span aria-hidden className="size-10 rounded-pill bg-surface-3" />
      )}
      <span className="font-display text-title font-bold">{account ? account.currency : "Choose"}</span>
      <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="size-3.5 text-muted-foreground">
        <path d="M6 9l6 6 6-6" />
      </svg>
    </button>
  );
}

function Shell({
  containerRef,
  step,
  onClose,
  children,
  centered,
}: {
  containerRef?: React.Ref<HTMLDivElement>;
  step: 1 | 2 | null;
  onClose: () => void;
  children: React.ReactNode;
  centered?: boolean;
}) {
  return (
    <div
      ref={containerRef}
      data-slot="convert-flow"
      data-screen-label="Convert"
      role="dialog"
      aria-modal="true"
      aria-labelledby={TITLE_ID}
      className="fixed inset-0 z-100 flex flex-col overflow-y-auto bg-background font-body text-foreground"
    >
      <header className="flex items-center justify-between px-3 py-2.5 desktop:px-6 desktop:py-4">
        <MbokaLogo size={28} />
        {step ? <span className="text-dense font-semibold text-muted-foreground">Step {step} of 2</span> : null}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex size-11 cursor-pointer items-center justify-center rounded-pill bg-muted text-foreground outline-none focus-visible:shadow-focus"
        >
          <span aria-hidden>✕</span>
        </button>
      </header>
      {step ? (
        <div
          role="progressbar"
          aria-label="Convert progress"
          aria-valuemin={1}
          aria-valuemax={2}
          aria-valuenow={step}
          className="h-0.75 shrink-0 bg-muted"
        >
          <div
            className={cn("h-full bg-primary transition-[width] duration-250 ease-standard", step === 1 ? "w-1/2" : "w-full")}
          />
        </div>
      ) : null}
      <main
        className={cn(
          "mx-auto flex w-full flex-col gap-4 px-4 pb-12 pt-6 desktop:px-6",
          centered ? "my-auto max-w-145" : "max-w-130 desktop:pt-10",
        )}
      >
        {children}
      </main>
    </div>
  );
}

function AccountPicker({
  side,
  accounts,
  selectedId,
  reasonFor,
  onPick,
  onClose,
}: {
  side: "from" | "to";
  accounts: ConvertAccountOption[];
  selectedId: string;
  /** Why an account can't be picked, or null when it can. */
  reasonFor: (a: ConvertAccountOption) => string | null;
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = React.useState("");
  const q = query.trim().toLowerCase();
  const shown = q ? accounts.filter((a) => haystack(a).includes(q)) : accounts;
  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent
        layer="flow"
        title={side === "from" ? "Convert from" : "Convert into"}
        description={side === "from" ? "Which account is the money coming out of?" : "Pick where the money lands."}
      >
        <div className="flex flex-col gap-3">
          {accounts.length > PICKER_SEARCH_THRESHOLD ? (
            <SearchBox
              label="Search accounts"
              placeholder="Search by name, currency or balance"
              value={query}
              onChange={setQuery}
            />
          ) : null}
          {q && shown.length === 0 ? (
            <p className="px-1 text-body text-muted-foreground">No accounts match “{query.trim()}”.</p>
          ) : null}
          <PickList label={side === "from" ? "Account to convert from" : "Account to convert into"} scrollable={accounts.length > PICKER_SEARCH_THRESHOLD}>
            {shown.map((a) => {
              const reason = reasonFor(a);
              return (
                <PickRow
                  key={a.id}
                  leading={<AccountMark account={a} />}
                  title={a.label}
                  meta={reason ?? undefined}
                  wrapMeta={Boolean(reason)}
                  hint={reason ?? undefined}
                  disabled={Boolean(reason)}
                  selected={a.id === selectedId}
                  trailing={<Amount value={a.balanceAmount} currency={a.currency} size="sm" />}
                  onClick={() => onPick(a.id)}
                />
              );
            })}
          </PickList>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Convert, as one screen: from and to side by side with a swap, the amount
 * and a live price, then one check-and-convert step and its outcome.
 * Presentational — quotes, accepting and polling stay in DashboardApp.
 */
export default function ConvertComposer({ containerRef, ...p }: ConvertComposerProps) {
  const [view, setView] = React.useState<"compose" | "review">("compose");
  const [picker, setPicker] = React.useState<"from" | "to" | null>(null);

  const source = p.sourceAccounts.find((a) => a.id === p.sourceAccountId);
  const dest = p.destinationAccounts.find((a) => a.id === p.destinationAccountId);
  const q = p.quote;
  const rateLocked = q?.rate_locked !== false;
  const estimated = Boolean(q?.destination_amount_estimated);
  const expired = Boolean(q) && rateLocked && p.quoteSeconds <= 0;
  const routeQuotable = isQuotableRoute(p.route);
  const noAccounts = p.sourceAccounts.length === 0 || p.destinationAccounts.length === 0;

  const amountNum = Number(String(p.amount || "").trim().replace(/,/g, ""));
  const balance = typeof source?.balanceAmount === "number" ? source.balanceAmount : null;
  const overBalance = balance !== null && Number.isFinite(amountNum) && amountNum > 0 && amountNum > balance;
  const emptyBalance = balance !== null && balance <= 0;
  const available = source && balance !== null ? formatAmount(balance) : null;

  const canQuote =
    routeQuotable &&
    Boolean(source && dest) &&
    Number.isFinite(amountNum) &&
    amountNum > 0 &&
    !overBalance &&
    !emptyBalance &&
    !p.quoteLoading;

  // Live pricing: one request per pause in typing. The parent clears the quote
  // and error whenever an account or the amount changes, which re-arms this.
  const autoQuote = canQuote && !q && !p.error && !p.done;
  const refreshRef = React.useRef(p.onRefreshQuote);
  React.useEffect(() => {
    refreshRef.current = p.onRefreshQuote;
  });
  React.useEffect(() => {
    if (!autoQuote) return undefined;
    const timer = window.setTimeout(() => refreshRef.current(), AUTO_QUOTE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [autoQuote, p.sourceAccountId, p.destinationAccountId, p.amount]);

  const feeCurrency = (q?.fee_currency || q?.source_currency || "").toUpperCase();
  const feeText = q
    ? p.feeText?.trim() ||
      feeDisclosureText({
        raw: q.fee_amount,
        formatted: `${formatConvertAmount(q.fee_amount)}${feeCurrency ? ` ${feeCurrency}` : ""}`,
        whenUnknown:
          q.fee_status === "estimated"
            ? "Charged on top by the provider — final figure once settled"
            : "Shown on your statement once settled",
      })
    : null;
  const err = p.error ? friendlyError(p.error) : null;
  const arrives = arrival(p.route, source, dest);

  // ── Outcomes ──────────────────────────────────────────────────────────────
  if (p.done && q) {
    const status = String(q.status || "").toLowerCase();
    if (q.route === "bridged" && status !== "completed") {
      return (
        <Shell containerRef={containerRef} step={null} onClose={p.onDone} centered>
          <JobStatus quote={q} sourceLabel={source?.label} destLabel={dest?.label} note={p.progressNote} onDone={p.onDone} />
        </Shell>
      );
    }
    return (
      <Shell containerRef={containerRef} step={null} onClose={p.onDone} centered>
        <div className="flex flex-col items-center gap-3 text-center">
          <span aria-hidden className="flex size-16 items-center justify-center rounded-pill bg-accent text-primary">
            <TickMark className="size-8" />
          </span>
          <Badge tone="success">Settled</Badge>
          <h1 id={TITLE_ID} className="font-display text-hero font-bold leading-tight tracking-display">
            Converted
          </h1>
          <p className="text-lead leading-body text-muted-foreground">
            {`${formatConvertAmount(q.destination_amount)} ${q.destination_currency} is in your ${dest?.label || `${q.destination_currency} account`}.`}
          </p>
        </div>
        <ConversionDetails quote={q} feeText={feeText} sourceLabel={source?.label} destLabel={dest?.label} settled />
        <div className="flex justify-center">
          <Button className="rounded-pill px-8" onClick={p.onDone}>
            Done
          </Button>
        </div>
      </Shell>
    );
  }

  // ── Check and convert ─────────────────────────────────────────────────────
  if (view === "review") {
    return (
      <Shell containerRef={containerRef} step={2} onClose={p.onDone}>
        <StepHeading
          title="Check and convert"
          titleId={TITLE_ID}
          onBack={() => setView("compose")}
          sub={
            q ? (
              <>
                Convert <Amount value={q.source_amount} currency={q.source_currency} /> into{" "}
                {estimated ? "about " : ""}
                <Amount value={q.destination_amount} currency={q.destination_currency} />.
              </>
            ) : undefined
          }
        />
        {!q ? (
          <Notice tone="info" role="status">
            Getting a new rate…
          </Notice>
        ) : !rateLocked ? (
          <Notice tone="info" role="note">
            The rate isn’t locked: it’s priced when it arrives, so what lands may differ a little.
          </Notice>
        ) : expired ? (
          <Notice tone="warning">
            <p className="font-bold">The rate ran out</p>
            <p>Rates move, so we only hold one for a short time. Get a new one to see today’s price before you convert.</p>
          </Notice>
        ) : (
          <div role="timer" aria-live="off" className="flex flex-col gap-2 rounded-xl bg-warning-tint px-4 py-3 text-warning-text">
            <div className="flex items-center justify-between gap-3 text-body-lg">
              <span className="font-bold">
                Rate locked for <span className="font-mono tabular-nums">{clock(p.quoteSeconds)}</span>
              </span>
              <span className="text-dense">Then we get you a new one</span>
            </div>
            <div aria-hidden className="h-1 overflow-hidden rounded-pill bg-surface-3">
              <div
                className="h-full rounded-pill bg-warning transition-[width] duration-1000 ease-linear motion-reduce:transition-none"
                style={{ width: `${Math.min(100, Math.round((p.quoteSeconds / 120) * 100))}%` }}
              />
            </div>
          </div>
        )}
        {q ? <ConversionDetails quote={q} feeText={feeText} sourceLabel={source?.label} destLabel={dest?.label} arrives={arrives} dimmed={expired} /> : null}
        {q?.notice ? (
          <Notice tone="info" role="note">
            {q.notice}
          </Notice>
        ) : null}
        {err ? (
          <Notice tone="danger">
            <p className="font-bold">{err.title}</p>
            <p>{err.body}</p>
          </Notice>
        ) : null}
        <p className="text-body leading-body text-muted-foreground">
          Once converted, the money stays in {q?.destination_currency || dest?.currency || "the new currency"}. To go back you
          convert again at the rate of the day.
        </p>
        <div className="flex justify-center">
          {!q || expired ? (
            <Button className="rounded-pill px-8" loading={p.quoteLoading} disabled={p.quoteLoading} onClick={p.onRefreshQuote}>
              Get a new rate
            </Button>
          ) : (
            <Button className="rounded-pill px-8" loading={p.acceptLoading} disabled={p.acceptLoading} onClick={p.onAccept}>
              Convert {formatAmount(q.source_amount)} {q.source_currency}
            </Button>
          )}
        </div>
      </Shell>
    );
  }

  // ── Compose ───────────────────────────────────────────────────────────────
  const pickerOpen = picker !== null;
  const swappable = Boolean(source && dest) && p.sourceAccounts.some((a) => a.id === dest?.id);
  return (
    <Shell containerRef={containerRef} step={1} onClose={p.onDone}>
      <StepHeading title="Convert" titleId={TITLE_ID} />
      {noAccounts ? (
        <EmptyState
          title="Accounts needed"
          description="Open at least two accounts. Convert works out the route between whichever two you pick."
        />
      ) : (
        <>
          <div className="relative flex flex-col gap-2">
            <section role="group" aria-label="From" className="flex flex-col gap-3 rounded-3xl border border-border bg-card px-4 pb-4 pt-3.5">
              <div className="flex items-center justify-between gap-3">
                <span className="text-label font-bold uppercase tracking-label text-subtle-foreground">From</span>
                {available ? (
                  <span className="text-body text-muted-foreground">
                    <Amount value={balance} currency={source?.currency || ""} size="sm" /> available
                  </span>
                ) : null}
              </div>
              <div className="flex items-center gap-3">
                <AccountPill side="From" account={source} onClick={() => setPicker("from")} />
                {routeQuotable || p.route.kind === "incomplete" ? (
                  <input
                    inputMode="decimal"
                    autoComplete="off"
                    aria-label={`Amount to convert, ${source?.currency || ""}`.trim()}
                    placeholder="0.00"
                    value={p.amount}
                    onChange={(e) => p.onAmount(e.target.value)}
                    className="h-14 min-w-0 flex-1 border-0 bg-transparent text-right font-mono text-page tabular-nums text-foreground outline-none placeholder:text-placeholder desktop:text-hero"
                  />
                ) : null}
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="truncate text-body text-muted-foreground">{source?.label}</span>
                {balance !== null && balance > 0 && (routeQuotable || p.route.kind === "incomplete") ? (
                  <Button variant="link" size="sm" onClick={() => p.onAmount(balance.toFixed(2))}>
                    Use max
                  </Button>
                ) : null}
              </div>
            </section>

            <button
              type="button"
              aria-label="Swap from and to"
              disabled={!swappable}
              onClick={() => {
                if (!source || !dest) return;
                p.onSourceAccount(dest.id);
                p.onDestinationAccount(source.id);
              }}
              className="absolute left-1/2 top-1/2 z-1 flex size-12 -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center rounded-pill border-4 border-background bg-primary text-primary-foreground outline-none focus-visible:shadow-focus disabled:cursor-not-allowed disabled:opacity-60"
            >
              <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="size-4.5">
                <path d="M8 4v16M8 20l-4-4M8 20l4-4M16 20V4M16 4l-4 4M16 4l4 4" />
              </svg>
            </button>

            <section role="group" aria-label="To" className="flex flex-col gap-3 rounded-3xl border border-border bg-card px-4 pb-4 pt-3.5">
              <div className="flex items-center justify-between gap-3">
                <span className="text-label font-bold uppercase tracking-label text-subtle-foreground">To</span>
                {dest ? (
                  <span className="text-body text-muted-foreground">
                    Balance <Amount value={dest.balanceAmount} currency={dest.currency} size="sm" />
                  </span>
                ) : null}
              </div>
              <div className="flex items-center gap-3">
                <AccountPill side="To" account={dest} onClick={() => setPicker("to")} />
                <output
                  aria-label={`You get${dest ? `, ${dest.currency}` : ""}`}
                  className={cn(
                    "min-w-0 flex-1 truncate text-right font-mono text-page tabular-nums desktop:text-hero",
                    q ? "text-link" : "text-subtle-foreground",
                  )}
                >
                  {q ? (
                    <>
                      {estimated ? <span>≈ </span> : null}
                      <span>{formatConvertAmount(q.destination_amount)}</span>
                    </>
                  ) : p.quoteLoading ? (
                    "…"
                  ) : (
                    "—"
                  )}
                </output>
              </div>
              <div className="flex min-h-11 items-center justify-between gap-3">
                <span className="truncate text-body text-muted-foreground">{dest?.label}</span>
                {arrives ? <span className="text-body text-muted-foreground">{arrives}</span> : null}
              </div>
            </section>
          </div>

          {p.route.kind === "unsupported" ? (
            <Notice tone="warning" role="status">
              <p className="font-bold">We can’t convert this pair</p>
              <p>{p.route.reason}</p>
            </Notice>
          ) : null}
          {emptyBalance ? (
            <Notice tone="info" role="status">
              This account has no balance to convert. Pick another From account.
            </Notice>
          ) : overBalance && available ? (
            <Notice tone="warning" role="status">
              {`That’s more than the ${available} ${source?.currency} available.`}
            </Notice>
          ) : null}
          {err ? (
            <Notice tone="danger">
              <p className="font-bold">{err.title}</p>
              <p>{err.body}</p>
            </Notice>
          ) : null}

          {q ? (
            <section aria-label="Price breakdown" className="rounded-3xl border border-border bg-card px-5 py-1.5">
              <dl>
                <DetailRow label="Rate">
                  <span className="font-mono">
                    {describeConversionRate(q)}
                    {rateLocked ? "" : " · estimated"}
                  </span>
                </DetailRow>
                <DetailRow label="Fees · paid by you">
                  <span className="font-mono">{feeText}</span>
                </DetailRow>
              </dl>
            </section>
          ) : routeQuotable && !err && !overBalance && !emptyBalance ? (
            <p role="status" className="text-center text-body text-muted-foreground">
              {p.quoteLoading
                ? "Getting the live rate and fee…"
                : "Enter an amount to see the live rate and fee, before you confirm anything."}
            </p>
          ) : null}

          <div className="flex justify-center">
            <Button
              className="rounded-pill px-8"
              disabled={!q || expired || overBalance || emptyBalance || !routeQuotable}
              onClick={() => setView("review")}
            >
              Continue
            </Button>
          </div>
          {q ? (
            <p className="text-center text-dense text-subtle-foreground">
              The price updates as you type. You lock the rate on the next step.
            </p>
          ) : null}
        </>
      )}

      {pickerOpen ? (
        <AccountPicker
          side={picker}
          accounts={picker === "from" ? p.sourceAccounts : p.destinationAccounts}
          selectedId={picker === "from" ? p.sourceAccountId : p.destinationAccountId}
          reasonFor={(a) => {
            if (picker === "from") {
              return typeof a.balanceAmount === "number" && a.balanceAmount <= 0 ? "No balance to convert" : null;
            }
            const r = resolveConvertRoute(source, a);
            return r.kind === "unsupported" ? r.reason : null;
          }}
          onPick={(id) => {
            if (picker === "from") p.onSourceAccount(id);
            else p.onDestinationAccount(id);
            setPicker(null);
          }}
          onClose={() => setPicker(null)}
        />
      ) : null}
    </Shell>
  );
}

function ConversionDetails({
  quote,
  feeText,
  sourceLabel,
  destLabel,
  arrives,
  dimmed,
  settled,
}: {
  quote: ConversionOut;
  feeText: string | null;
  sourceLabel?: string;
  destLabel?: string;
  arrives?: string | null;
  dimmed?: boolean;
  settled?: boolean;
}) {
  const approx = quote.destination_amount_estimated ? "≈ " : "";
  const into = destLabel || `${quote.destination_currency} account`;
  return (
    <section aria-label="Conversion details" className="rounded-3xl border border-border bg-card px-5 py-1.5">
      <dl>
        <DetailRow label="From">{sourceLabel || `${quote.source_currency} account`}</DetailRow>
        <DetailRow label="Into">{into}</DetailRow>
        <div className="border-t border-border">
          <DetailRow label={settled ? "You converted" : "You convert"}>
            <Amount value={quote.source_amount} currency={quote.source_currency} size="sm" />
          </DetailRow>
        </div>
        <DetailRow label="Fees · paid by you">
          <span className={cn("font-mono", dimmed && "text-muted-foreground")}>{dimmed ? "—" : feeText}</span>
        </DetailRow>
        <DetailRow label="Rate">
          <span className={cn("font-mono", dimmed && "text-muted-foreground")}>{dimmed ? "—" : describeConversionRate(quote)}</span>
        </DetailRow>
        <div className="border-t border-border">
          <DetailRow label={settled ? `Landed in ${into}` : `Lands in ${into}`} strong>
            {dimmed ? (
              <span className="font-mono text-muted-foreground">—</span>
            ) : (
              <span className="font-mono text-link">
                {approx}
                {formatConvertAmount(quote.destination_amount)} {quote.destination_currency}
              </span>
            )}
          </DetailRow>
        </div>
        {arrives ? <DetailRow label="Arrives">{arrives}</DetailRow> : null}
        {settled && quote.id ? (
          <DetailRow label="Reference">
            <span className="font-mono">{quote.id}</span>
          </DetailRow>
        ) : null}
      </dl>
    </section>
  );
}

/** A conversion that runs in stages: where it is, or where the money went. */
function JobStatus({
  quote,
  sourceLabel,
  destLabel,
  note,
  onDone,
}: {
  quote: ConversionOut;
  sourceLabel?: string;
  destLabel?: string;
  note?: string | null;
  onDone: () => void;
}) {
  const status = String(quote.status || "pending").toLowerCase();
  const terminal = isTerminalConversionStatus(status);
  const stages = quote.stages && quote.stages.length > 0 ? quote.stages : [status];
  const current = stages.indexOf(status);
  const from = sourceLabel || `${quote.source_currency} account`;
  const sent = `${formatConvertAmount(quote.source_amount)} ${quote.source_currency}`;

  let title = "Converting";
  let badge: { tone: "warning" | "danger"; label: string } = { tone: "warning", label: "Pending" };
  let body: string =
    quote.stage ||
    `${sent} into ${quote.destination_amount_estimated ? "about " : ""}${formatConvertAmount(quote.destination_amount)} ${quote.destination_currency}. This usually takes a few minutes.`;
  if (status === "returning") {
    title = "Returning your money";
    badge = { tone: "warning", label: "Returning" };
    body = `${quote.return_reason ? `${quote.return_reason} ` : ""}A step didn’t go through, so we’re sending ${sent} back to your ${from}.`;
  } else if (status === "returned") {
    title = "Your money is back";
    badge = { tone: "danger", label: "Not converted" };
    body = `${quote.return_reason ? `${quote.return_reason} ` : ""}We sent ${sent} back to your ${from}.`;
  } else if (status === "failed") {
    title = "Needs support";
    badge = { tone: "danger", label: "Failed" };
    body = `${quote.error ? `${quote.error} ` : ""}Our team has to finish this one. Contact support with the reference below.`;
  }
  const showStages = status !== "failed" && status !== "returned";

  return (
    <>
      <div role="status" aria-live="polite" className="flex flex-col items-center gap-3 text-center">
        <Badge tone={badge.tone}>{badge.label}</Badge>
        <h1 id={TITLE_ID} className="font-display text-hero font-bold leading-tight tracking-display">
          {title}
        </h1>
        <p className="text-lead leading-body text-muted-foreground">{body}</p>
      </div>

      {showStages ? (
        <section className="rounded-3xl border border-border bg-card px-5 py-4">
          <ol aria-label="Conversion steps" className="flex flex-col">
            {stages.map((stage, i) => {
              const state = status === "completed" || (current >= 0 && i < current) ? "done" : i === current ? "current" : "todo";
              const last = i === stages.length - 1;
              return (
                <li key={stage} aria-current={state === "current" ? "step" : undefined} className="flex gap-3.5">
                  <span className="flex shrink-0 flex-col items-center">
                    <span
                      aria-hidden
                      className={cn(
                        "flex size-8 items-center justify-center rounded-pill",
                        state === "done" && "bg-primary text-primary-foreground",
                        state === "current" && "border-2 border-primary bg-accent text-primary",
                        state === "todo" && "border border-input bg-muted text-subtle-foreground",
                      )}
                    >
                      {state === "done" ? (
                        <TickMark className="size-4" />
                      ) : (
                        <span className={cn("size-2 rounded-pill bg-current", state === "current" && "motion-safe:animate-pulse")} />
                      )}
                    </span>
                    {last ? null : (
                      <span aria-hidden className={cn("min-h-5 w-0.5 flex-1", state === "done" ? "bg-primary" : "bg-surface-3")} />
                    )}
                  </span>
                  <span className={cn("flex flex-col gap-0.5 pt-1", last ? "" : "pb-4")}>
                    <span
                      className={cn(
                        "font-display text-lead",
                        state === "todo" ? "font-semibold text-muted-foreground" : "font-bold text-foreground",
                      )}
                    >
                      {CONVERSION_STAGE_LABELS[stage] || stage.replace(/_/g, " ")}
                    </span>
                    {state === "current" ? <span className="text-body font-semibold text-link">In progress</span> : null}
                  </span>
                </li>
              );
            })}
          </ol>
        </section>
      ) : null}

      <section aria-label="Details" className="rounded-3xl border border-border bg-card px-5 py-1.5">
        <dl>
          <DetailRow label="From">{from}</DetailRow>
          <DetailRow label="Into">{destLabel || `${quote.destination_currency} account`}</DetailRow>
          <DetailRow label="Reference">
            <span className="font-mono">{quote.id}</span>
          </DetailRow>
        </dl>
      </section>

      {!terminal ? (
        <p className="text-center text-body text-muted-foreground">
          You can close this. The conversion carries on, and it shows in Activity.
        </p>
      ) : null}
      {note ? <p className="text-center text-body text-muted-foreground">{note}</p> : null}
      <div className="flex justify-center">
        <Button variant={terminal ? "primary" : "secondary"} className="rounded-pill px-8" onClick={onDone}>
          {terminal ? "Done" : "Close"}
        </Button>
      </div>
    </>
  );
}
