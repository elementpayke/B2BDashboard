"use client";

import React from "react";
import { feeDisclosureText } from "@/components/money/FeeDisclosure";
import {
  describeConversionRate,
  formatConvertAmount,
  type ConversionOut,
} from "@/lib/services/conversions";

export type ConvertAccountOption = {
  id: string;
  currency: string;
  label: string;
  /** Localized, for display only — never parse this back into a number. */
  balanceLabel: string;
  /** Raw available balance. Null when the partner returned none. */
  balanceAmount: number | null;
};

/**
 * `stable_to_stable` is intentionally absent.
 *
 * It only ever served Stellar `USDT|EURC → USDC` swaps, which Mboka gates
 * behind `STELLAR_SWAPS_ENABLED` (default false — "stubbed until partner
 * hardens the path"). With Stellar accounts kept out of the ledger
 * conversion rail — they carry an `ep_stellar:` id Nuvion rejects with a 502 —
 * the mode had no source accounts to offer and was a dead end in the UI.
 *
 * The route itself still exists server-side. Restore the mode here when
 * either the Stellar flag is on, or Nuvion is confirmed to quote USC↔UST
 * (see scripts/check_nuvion_fx_pair.py in the aggregator) — not before, or
 * the tab is selectable with an empty source list again.
 */
export type ConvertMode = "fiat_to_stable" | "stable_to_fiat" | "fiat_to_fiat";

export function isConvertMode(value: string | null | undefined): value is ConvertMode {
  return (
    value === "fiat_to_stable" || value === "stable_to_fiat" || value === "fiat_to_fiat"
  );
}

/** Unknown values — including a persisted `stable_to_stable` — fall back. */
export function normalizeConvertMode(value: string | null | undefined): ConvertMode {
  return isConvertMode(value) ? value : "fiat_to_stable";
}

export type ConvertFlowProps = {
  mode: ConvertMode;
  onMode: (mode: ConvertMode) => void;
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
   * all three directions (ledger FX, ramp, Stellar swap) disclose a fee
   * without the call site having to remember to pass one.
   */
  feeText?: string | null;
  done: boolean;
  doneBody?: string;
  onRefreshQuote: () => void;
  onAccept: () => void;
  onDone: () => void;
};

const MODES: { key: ConvertMode; label: string; hint: string }[] = [
  // Hints no longer name currencies: the pickers below are the source of
  // truth and listing three of seven read as a limit that isn't real.
  { key: "fiat_to_stable", label: "Fiat → Stablecoin", hint: "Sell a fiat balance for USDC or USDT" },
  { key: "stable_to_fiat", label: "Stablecoin → Fiat", hint: "Sell USDC or USDT for a fiat balance" },
  {
    key: "fiat_to_fiat",
    label: "Fiat ↔ Fiat",
    hint: "Convert between your fiat accounts (same business, different currencies)",
  },
];

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
  const canQuote =
    Boolean(p.sourceAccountId) &&
    Boolean(p.destinationAccountId) &&
    Boolean(p.amount.trim()) &&
    !p.quoteLoading &&
    !zeroKnownBalance &&
    !insufficientKnownBalance &&
    p.sourceAccounts.length > 0 &&
    p.destinationAccounts.length > 0;
  const canAccept = Boolean(p.quote) && !expired && !p.acceptLoading && !p.done;
  const modeMeta = MODES.find((m) => m.key === p.mode) || MODES[0];
  const err = p.error ? friendlyError(p.error) : null;
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
  // Every direction into this component (ledger FX, fiat↔USDC ramp, Stellar
  // stable→stable) normalizes its preview into `ConversionOut`, so the fee is
  // always on the quote — read it there rather than depend on three separate
  // call sites remembering to forward it. Zero reads "No fee"; an absent
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
      <div className="ep-convert__panel">
        <div className="ep-convert__tabs" role="tablist" aria-label="Convert direction">
          {MODES.map((m) => (
            <button
              key={m.key}
              type="button"
              role="tab"
              aria-selected={p.mode === m.key}
              data-active={p.mode === m.key ? "true" : "false"}
              className="ep-convert__tab"
              onClick={() => p.onMode(m.key)}
            >
              {m.label}
            </button>
          ))}
        </div>

        <p className="ep-convert__lede">{modeMeta.hint}</p>
        {p.pathLabel ? (
          <p className="ep-money-hint" data-testid="convert-path">
            Path: {p.pathLabel}
          </p>
        ) : null}
        {p.hopLabel ? <p className="ep-money-hint">{p.hopLabel}</p> : null}

        {p.sourceAccounts.length === 0 || p.destinationAccounts.length === 0 ? (
          <div className="ep-convert__expired" role="status">
            <span className="ep-convert__expired-title">Accounts needed</span>
            <span className="ep-convert__expired-body">
              {p.mode === "fiat_to_stable"
                ? "Open a fiat deposit account and a ready USDC or USDT account first."
                : p.mode === "stable_to_fiat"
                  ? "Open a ready USDC or USDT account and a fiat deposit account first."
                  : // Deliberately not listing the currencies: the set is seven
                    // and grows, and naming a subset here is what made Convert
                    // look GBP/USD-only in the first place.
                    "Open at least two fiat accounts in different currencies."}
            </span>
          </div>
        ) : (
          <>
            <div className="ep-convert__legs">
              <div className="ep-money-field">
                <label className="ep-money-label" htmlFor="convert-source">
                  From
                </label>
                <select
                  id="convert-source"
                  className="ep-money-input"
                  value={p.sourceAccountId}
                  onChange={(e) => p.onSourceAccount(e.target.value)}
                >
                  <option value="">Select source</option>
                  {p.sourceAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label}
                      {a.balanceLabel !== "—" ? ` · ${a.balanceLabel}` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="ep-convert__swap" aria-hidden>
                ↓
              </div>

              <div className="ep-money-field">
                <label className="ep-money-label" htmlFor="convert-dest">
                  To
                </label>
                <select
                  id="convert-dest"
                  className="ep-money-input"
                  value={p.destinationAccountId}
                  onChange={(e) => p.onDestinationAccount(e.target.value)}
                >
                  <option value="">Select destination</option>
                  {p.destinationAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label}
                      {a.balanceLabel !== "—" ? ` · ${a.balanceLabel}` : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>

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
          </>
        )}

        {err ? (
          <div className="ep-convert__expired" role="alert">
            <span className="ep-convert__expired-title">{err.title}</span>
            <span className="ep-convert__expired-body">{err.body}</span>
          </div>
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
              <div className="ep-convert__meta-row">
                <span className="ep-convert__meta-k">Settles via</span>
                <span className="ep-convert__meta-v">
                  {p.settlesViaLabel || `Ledger FX${dest ? ` · ${dest.label}` : ""}`}
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
                {p.acceptLoading ? "Settling…" : "Accept & settle"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
