"use client";

import React from "react";
import AssetSelect from "@/components/money/AssetSelect";
import { feeDisclosureText } from "@/components/money/FeeDisclosure";
import {
  describeConversionRate,
  formatConvertAmount,
  type ConversionOut,
} from "@/lib/services/conversions";
import { isQuotableRoute, type ConvertRoute } from "@/lib/services/convertRoutes";

export type ConvertAccountOption = {
  id: string;
  currency: string;
  label: string;
  /** Localized, for display only — never parse this back into a number. */
  balanceLabel: string;
  /** Raw available balance. Null when the partner returned none. */
  balanceAmount: number | null;
  /** Flag image for fiat with one country; null for shared/stablecoin. */
  flagUrl?: string | null;
  /** Settlement chain, badged onto a stablecoin's coin mark. */
  network?: string | null;
};

/**
 * There are no mode tabs any more.
 *
 * The user used to pick a direction ("Fiat → Stablecoin", …) which then
 * filtered the account lists. That asked them to know which of our three
 * backends services a pair — and left USDC ↔ USDT, an advertised product,
 * with no tab and therefore no route at all. Now both pickers list every
 * account they own and `resolveConvertRoute` derives the rail from the pair.
 *
 * @see lib/services/convertRoutes.ts for the routing table and its refusals.
 */
export type ConvertFlowProps = {
  /** Derived from the chosen pair — never chosen by the user. */
  route: ConvertRoute;
  sourceAccounts: ConvertAccountOption[];
  destinationAccounts: ConvertAccountOption[];
  sourceAccountId: string;
  destinationAccountId: string;
  onSourceAccount: (id: string) => void;
  onDestinationAccount: (id: string) => void;
  amount: string;
  onAmount: (value: string) => void;
  quote: ConversionOut | null;
  quoteSeconds: number;
  quoteLoading: boolean;
  acceptLoading: boolean;
  error: string;
  hopLabel?: string | null;
  /** Optional path strip for fiat↔fiat, e.g. "EUR → USDC → USD". */
  pathLabel?: string | null;
  settlesViaLabel?: string | null;
  /**
   * Overrides the fee read off the quote. Only for a flow whose fee is not
   * on `quote.fee_amount` — by default the quote's own figure is shown, so
   * all three rails (book transfer, ramp, ledger FX) disclose a fee without
   * the call site having to remember to pass one.
   */
  feeText?: string | null;
  done: boolean;
  doneBody?: string;
  onRefreshQuote: () => void;
  onAccept: () => void;
  onDone: () => void;
};

function friendlyError(message: string): { title: string; body: string } {
  const m = (message || "").trim();
  const lower = m.toLowerCase();
  if (!m || lower === "internal server error") {
    return {
      title: "Couldn't get a quote",
      body: "Something went wrong on our side. Try again in a moment.",
    };
  }
  if (lower.includes("insufficient")) {
    return { title: "Not enough balance", body: m };
  }
  if (lower.includes("minimum")) {
    return { title: "Amount too small", body: m };
  }
  if (lower.includes("usdc account") || lower.includes("usdt account") || lower.includes("stablecoin account")) {
    return { title: "Stablecoin account needed", body: m };
  }
  return { title: "Couldn't convert", body: m };
}

export default function ConvertFlow(p: ConvertFlowProps) {
  // The conversion keeps running whether or not the overlay is on screen —
  // hiding is a view preference, never a cancel. Re-arms for the next
  // attempt so dismissing once doesn't permanently silence progress.
  const [progressHidden, setProgressHidden] = React.useState(false);
  React.useEffect(() => {
    if (!p.acceptLoading) setProgressHidden(false);
  }, [p.acceptLoading]);

  const expired = p.quoteSeconds <= 0 && Boolean(p.quote);
  const source = p.sourceAccounts.find((a) => a.id === p.sourceAccountId);
  const dest = p.destinationAccounts.find((a) => a.id === p.destinationAccountId);
  const amountNum = Number(String(p.amount || "").trim().replace(/,/g, ""));
  const knownBalance =
    source && typeof source.balanceAmount === "number" ? source.balanceAmount : null;
  const insufficientKnownBalance =
    knownBalance !== null &&
    Number.isFinite(amountNum) &&
    amountNum > 0 &&
    amountNum > knownBalance;
  const zeroKnownBalance = knownBalance !== null && knownBalance <= 0;
  // An unsupported pair is refused here, before the amount field matters, so
  // the user never types a figure and presses a button to discover a 422.
  const routeQuotable = isQuotableRoute(p.route);
  const canQuote =
    routeQuotable &&
    Boolean(p.sourceAccountId) &&
    Boolean(p.destinationAccountId) &&
    Boolean(p.amount.trim()) &&
    !p.quoteLoading &&
    !zeroKnownBalance &&
    !insufficientKnownBalance &&
    p.sourceAccounts.length > 0 &&
    p.destinationAccounts.length > 0;
  const canAccept = Boolean(p.quote) && !expired && !p.acceptLoading && !p.done;
  const err = p.error ? friendlyError(p.error) : null;
  const noAccounts =
    p.sourceAccounts.length === 0 || p.destinationAccounts.length === 0;
  const available =
    source && source.balanceLabel && source.balanceLabel !== "—"
      ? source.balanceLabel
      : null;
  // Max fills from the raw amount. Deriving it from `available` would break in
  // locales that group with periods (`1.234,56` → `1.234.56`).
  const maxAmount =
    source && typeof source.balanceAmount === "number" && source.balanceAmount > 0
      ? source.balanceAmount
      : null;
  // Every rail into this component (book transfer, ramp, ledger FX)
  // normalizes its preview into `ConversionOut`, so the fee is always on the
  // quote — read it there rather than depend on three separate call sites
  // remembering to forward it. Zero reads "No fee"; an absent
  // figure says when it lands instead of implying the conversion is free.
  const quoteFeeCurrency =
    (p.quote?.fee_currency || p.quote?.source_currency || "").toUpperCase();
  const feeText = p.quote
    ? p.feeText?.trim() ||
      feeDisclosureText({
        raw: p.quote.fee_amount,
        formatted: `${formatConvertAmount(p.quote.fee_amount)}${quoteFeeCurrency ? ` ${quoteFeeCurrency}` : ""}`,
        whenUnknown: "Shown on your statement once settled",
      })
    : null;

  if (p.done) {
    return (
      <div className="ep-convert">
        <div className="ep-convert__success">
          <span className="ep-convert__success-icon" aria-hidden>
            ✓
          </span>
          <span className="ep-convert__success-title">Conversion complete</span>
          <span className="ep-convert__success-body">
            {p.doneBody || "Settled on your deposit accounts."}
          </span>
          <button
            type="button"
            className="ep-convert__btn ep-convert__btn--ghost"
            style={{ width: "auto", minWidth: 120, marginTop: 6 }}
            onClick={p.onDone}
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="ep-convert">
      {p.acceptLoading && !progressHidden ? (
        <div className="ep-convert__progress" role="status" aria-live="polite">
          <span className="ep-convert__spinner" aria-hidden />
          <span className="ep-convert__progress-text">
            <strong>Converting your balance…</strong>
            This usually takes a few seconds. You can keep watching or hide this —
            the conversion carries on either way.
          </span>
          <button
            type="button"
            className="ep-convert__progress-hide"
            onClick={() => setProgressHidden(true)}
          >
            Hide
          </button>
        </div>
      ) : null}

      <div className="ep-convert__panel">
        {/* The derived route, stated plainly. This replaced the mode tabs:
            the pair the user picked is the input, this line is the output. */}
        <p className="ep-convert__lede" data-testid="convert-route">
          {p.route.summary}
        </p>
        {p.pathLabel ? (
          <p className="ep-money-hint" data-testid="convert-path">
            Path: {p.pathLabel}
          </p>
        ) : null}
        {p.hopLabel ? <p className="ep-money-hint">{p.hopLabel}</p> : null}

        {noAccounts ? (
          <div className="ep-convert__expired" role="status">
            <span className="ep-convert__expired-title">Accounts needed</span>
            <span className="ep-convert__expired-body">
              {/* Deliberately not listing currencies: the convertible set is
                  nine and grows, and naming a subset here is what made
                  Convert look GBP/USD-only in the first place. */}
              Open at least two accounts — Convert works out the route between
              whichever two you pick.
            </span>
          </div>
        ) : (
          <>
            <div className="ep-convert__legs">
              <AssetSelect
                id="convert-source"
                label="From"
                placeholder="Choose an account to convert from"
                value={p.sourceAccountId}
                options={p.sourceAccounts}
                onChange={p.onSourceAccount}
              />

              <div className="ep-convert__swap" aria-hidden>
                ↓
              </div>

              <AssetSelect
                id="convert-dest"
                label="To"
                placeholder="Choose an account to receive"
                value={p.destinationAccountId}
                options={p.destinationAccounts}
                onChange={p.onDestinationAccount}
              />
            </div>

            {p.route.kind === "unsupported" ? (
              // Shown instead of the amount field, not after it. Letting a
              // user price a pair we are going to refuse is the failure this
              // whole routing change exists to prevent.
              <div className="ep-convert__expired" role="status">
                <span className="ep-convert__expired-title">
                  We can&apos;t convert this pair
                </span>
                <span
                  className="ep-convert__expired-body"
                  data-testid="convert-unsupported"
                >
                  {p.route.reason}
                </span>
              </div>
            ) : (
            <div className="ep-money-field">
              <div className="ep-convert__amount-head">
                <label className="ep-money-label" htmlFor="convert-amount">
                  Amount{source ? ` (${source.currency})` : ""}
                </label>
                {available && maxAmount !== null ? (
                  <button
                    type="button"
                    className="ep-convert__max"
                    onClick={() => p.onAmount(maxAmount.toFixed(2))}
                  >
                    Max {available}
                  </button>
                ) : null}
              </div>
              <input
                id="convert-amount"
                className="ep-money-input ep-money-input--amount"
                inputMode="decimal"
                placeholder="Min 1.00"
                value={p.amount}
                onChange={(e) => p.onAmount(e.target.value)}
              />
              {available ? (
                <p className="ep-convert__avail">Available {available}{source ? ` ${source.currency}` : ""}</p>
              ) : null}
              {zeroKnownBalance ? (
                <p className="ep-money-hint" role="status">
                  This account has no available balance — pick a funded From account to get a quote.
                </p>
              ) : null}
              {insufficientKnownBalance ? (
                <p className="ep-money-hint" role="status">
                  Amount is above the available balance
                  {available ? ` (${available}${source ? ` ${source.currency}` : ""})` : ""}.
                </p>
              ) : null}
            </div>
            )}
          </>
        )}

        {err ? (
          <div className="ep-convert__expired" role="alert">
            <span className="ep-convert__expired-title">{err.title}</span>
            <span className="ep-convert__expired-body">{err.body}</span>
          </div>
        ) : null}

        {/* Fee is stated before the quote too. Showing it only after quoting
            means a user decides to convert without knowing whether it costs
            anything, which is the gap this whole change set exists to close. */}
        {!p.quote && !noAccounts && routeQuotable ? (
          <p className="ep-convert__prefee" role="status">
            Fees are shown with your quote, before you confirm anything.
          </p>
        ) : null}

        {p.quote ? (
          <>
            <div className="ep-convert__quote">
              <div className="ep-convert__row">
                <span className="ep-convert__amount">
                  {formatConvertAmount(p.quote.source_amount)}
                </span>
                <span className="ep-convert__ccy">{p.quote.source_currency}</span>
              </div>
              <div className="ep-convert__arrow" aria-hidden>
                ↓
              </div>
              <div className="ep-convert__row">
                <span className="ep-convert__amount ep-convert__amount--out">
                  {formatConvertAmount(p.quote.destination_amount)}
                </span>
                <span className="ep-convert__ccy">{p.quote.destination_currency}</span>
              </div>
            </div>
            <div className="ep-convert__meta">
              <div className="ep-convert__meta-row">
                <span className="ep-convert__meta-k">Rate</span>
                <span className="ep-convert__meta-v ep-convert__meta-v--mono">
                  {describeConversionRate(p.quote)}
                </span>
              </div>
              <div className="ep-convert__meta-row">
                <span className="ep-convert__meta-k">Fee</span>
                <span
                  className="ep-convert__meta-v ep-convert__meta-v--mono"
                  data-testid="convert-fee"
                >
                  {feeText}
                </span>
              </div>
              <div className="ep-convert__meta-row ep-convert__meta-row--total">
                <span className="ep-convert__meta-k">You receive</span>
                <span className="ep-convert__meta-v ep-convert__meta-v--mono">
                  {formatConvertAmount(p.quote.destination_amount)}{" "}
                  {p.quote.destination_currency}
                </span>
              </div>
              <div className="ep-convert__meta-row">
                <span className="ep-convert__meta-k">Settles via</span>
                <span className="ep-convert__meta-v" data-testid="convert-settles-via">
                  {p.settlesViaLabel ||
                    p.route.settlesVia ||
                    `Ledger FX${dest ? ` · ${dest.label}` : ""}`}
                </span>
              </div>
            </div>
            {expired ? (
              <div className="ep-convert__expired" role="alert">
                <span className="ep-convert__expired-title">Rate expired</span>
                <span className="ep-convert__expired-body">
                  Refresh for a live rate — a stale quote can&apos;t be accepted.
                </span>
              </div>
            ) : (
              <div className="ep-convert__timer" role="timer" aria-live="off">
                <span className="ep-convert__timer-label">
                  Quote locks for {p.quoteSeconds}s
                </span>
                <div className="ep-convert__timer-track">
                  <div
                    className="ep-convert__timer-fill"
                    style={{
                      width: `${Math.min(100, Math.round((p.quoteSeconds / 120) * 100))}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </>
        ) : null}

        <div className="ep-convert__actions">
          {!p.quote || expired ? (
            <button
              type="button"
              className="ep-convert__btn ep-convert__btn--primary"
              onClick={p.onRefreshQuote}
              disabled={!canQuote}
            >
              {p.quoteLoading ? "Getting quote…" : expired ? "Refresh quote" : "Get quote"}
            </button>
          ) : (
            <>
              <button
                type="button"
                className="ep-convert__btn ep-convert__btn--ghost"
                onClick={p.onRefreshQuote}
                disabled={!canQuote}
              >
                {p.quoteLoading ? "Refreshing…" : "Refresh"}
              </button>
              <button
                type="button"
                className="ep-convert__btn ep-convert__btn--primary"
                onClick={p.onAccept}
                disabled={!canAccept}
              >
                {p.acceptLoading ? "Converting…" : "Accept & convert"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
