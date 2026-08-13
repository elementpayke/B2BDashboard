"use client";

import React from "react";
import {
  describeConversionRate,
  formatConvertAmount,
  type ConversionOut,
} from "@/lib/services/conversions";

export type ConvertAccountOption = {
  id: string;
  currency: string;
  label: string;
  balanceLabel: string;
};

export type ConvertMode = "fiat_to_stable" | "stable_to_fiat" | "fiat_to_fiat";

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
  done: boolean;
  doneBody?: string;
  onRefreshQuote: () => void;
  onAccept: () => void;
  onDone: () => void;
};

const MODES: { key: ConvertMode; label: string; hint: string }[] = [
  { key: "fiat_to_stable", label: "Fiat → USDC", hint: "Sell EUR, USD, or GBP for USDC" },
  { key: "stable_to_fiat", label: "USDC → Fiat", hint: "Sell USDC for EUR, USD, or GBP" },
  { key: "fiat_to_fiat", label: "EUR ↔ USD", hint: "Two hops via USDC" },
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
  if (lower.includes("min")) {
    return { title: "Amount too small", body: m };
  }
  if (lower.includes("usdc account")) {
    return { title: "USDC account needed", body: m };
  }
  return { title: "Couldn't convert", body: m };
}

export default function ConvertFlow(p: ConvertFlowProps) {
  const expired = p.quoteSeconds <= 0 && Boolean(p.quote);
  const source = p.sourceAccounts.find((a) => a.id === p.sourceAccountId);
  const dest = p.destinationAccounts.find((a) => a.id === p.destinationAccountId);
  const canQuote =
    Boolean(p.sourceAccountId) &&
    Boolean(p.destinationAccountId) &&
    Boolean(p.amount.trim()) &&
    !p.quoteLoading &&
    p.sourceAccounts.length > 0 &&
    p.destinationAccounts.length > 0;
  const canAccept = Boolean(p.quote) && !expired && !p.acceptLoading && !p.done;
  const modeMeta = MODES.find((m) => m.key === p.mode) || MODES[0];
  const err = p.error ? friendlyError(p.error) : null;
  const available =
    source && source.balanceLabel && source.balanceLabel !== "—"
      ? source.balanceLabel
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
        {p.mode === "fiat_to_fiat" ? (
          <p className="ep-money-hint">
            Fiat↔fiat isn&apos;t a direct rail — we convert via USDC in two steps.
          </p>
        ) : null}
        {p.hopLabel ? <p className="ep-money-hint">{p.hopLabel}</p> : null}

        {p.sourceAccounts.length === 0 || p.destinationAccounts.length === 0 ? (
          <div className="ep-convert__expired" role="status">
            <span className="ep-convert__expired-title">Accounts needed</span>
            <span className="ep-convert__expired-body">
              {p.mode === "fiat_to_stable"
                ? "Open a fiat deposit account and a ready USDC account first."
                : p.mode === "stable_to_fiat"
                  ? "Open a ready USDC account and a fiat deposit account first."
                  : "Open EUR and USD deposit accounts plus a ready USDC bridge account."}
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
                  {p.mode === "fiat_to_fiat" && !p.hopLabel?.includes("Hop 2")
                    ? "Final destination"
                    : "To"}
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
                {available ? (
                  <button
                    type="button"
                    className="ep-convert__max"
                    onClick={() => p.onAmount(available.replace(/,/g, ""))}
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
                <span className="ep-convert__meta-k">Settles via</span>
                <span className="ep-convert__meta-v">
                  Ledger FX{dest ? ` · ${dest.label}` : ""}
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
