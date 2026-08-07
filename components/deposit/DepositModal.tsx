"use client";
import React, { useState } from "react";

export type DepositModalProps = {
  depositNotDone: boolean;
  depositDone: boolean;
  depositStepDots: { on: boolean }[];
  depositStepIs1: boolean;
  depositStepIs2: boolean;
  depositStepIs3: boolean;
  depositMethods: any[];
  depositIsCountry: boolean;
  depositIsCrypto: boolean;
  depositCountryChips: any[];
  depositRailHasChoice: boolean;
  depositRailChips: any[];
  depositProviderHasChoice: boolean;
  depositProviderChips: any[];
  depositAssets: any[];
  depositNetworks: any[];
  depositNext: () => void;
  depositBack: () => void;
  depositDestinationSummary: string;
  depositIsMobileRail: boolean;
  depositIsBankRail: boolean;
  depositPayerLabel: string;
  depositPayerPlaceholder: string;
  depositPhone: string;
  setDepositPhone: (e: React.ChangeEvent<HTMLInputElement>) => void;
  depositMobileCode: string;
  depositAmount: string;
  setDepositAmount: (e: React.ChangeEvent<HTMLInputElement>) => void;
  depositAmountLabel: string;
  depositQuoteError: string;
  depositQuoteLoading: boolean;
  depositQuoteRateText: string | null;
  depositFeeText: string;
  depositArrivalText: string;
  depositAcceptError: string;
  depositAccepting: boolean;
  submitDeposit: () => void;
  depositResultText: string | null;
  depositLiveStatus: { label: string; color: string; soft: string; isSettling: boolean } | null;
  depositOperator: string;
  depositBankLabel: string;
  depositBankArrival: string;
  depositBankLines: any[];
  depositPromptSent: boolean;
  depositAssetCode: string;
  depositNetworkLabel: string;
  depositAddress: string;
  closeModal: () => void;
};

function StepProgress({ dots, label }: { dots: { on: boolean }[]; label: string }) {
  const current = Math.max(1, dots.findIndex((d) => !d.on));
  const step = dots.every((d) => d.on) ? dots.length : current;
  return (
    <div
      className="ep-money-steps"
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={dots.length || 3}
      aria-valuenow={step}
      aria-label={label}
    >
      {(dots || []).map((d, i) => (
        <span
          key={i}
          className={`ep-money-steps__dot${d.on ? " ep-money-steps__dot--on" : ""}`}
        />
      ))}
    </div>
  );
}

export default function DepositModal(p: DepositModalProps) {
  const [addressCopied, setAddressCopied] = useState(false);
  const hasAddress = Boolean(p.depositAddress && p.depositAddress !== "—");

  const copyDepositAddress = () => {
    if (!hasAddress || !navigator.clipboard) return;
    navigator.clipboard.writeText(p.depositAddress).catch(() => {});
    setAddressCopied(true);
    window.setTimeout(() => setAddressCopied(false), 1800);
  };

  return (
    <>
      {p.depositNotDone ? (
        <div className="ep-money-flow">
          <StepProgress dots={p.depositStepDots || []} label="Deposit progress" />

          {p.depositStepIs1 ? (
            <div className="ep-money-section">
              <span className="ep-money-step-label">Step 1 · How are you topping up?</span>
              <div className="ep-chip-row" role="group" aria-label="Deposit method">
                {(p.depositMethods || []).map((dm: any, i: number) => (
                  <button
                    key={i}
                    type="button"
                    onClick={dm.select}
                    className="ep-money-choice"
                    style={{ background: dm.bg, color: dm.color }}
                  >
                    {dm.label}
                  </button>
                ))}
              </div>

              {p.depositIsCountry ? (
                <>
                  <div className="ep-money-field">
                    <span className="ep-money-label" id="deposit-country-label">
                      Source country
                    </span>
                    <div
                      className="ep-chip-row"
                      role="group"
                      aria-labelledby="deposit-country-label"
                    >
                      {(p.depositCountryChips || []).map((c: any, i: number) => (
                        <button
                          key={i}
                          type="button"
                          onClick={c.selectDeposit}
                          className="ep-money-choice ep-money-choice--flag ep-money-choice--outlined"
                          style={{
                            borderColor: c.depositBorder,
                            background: c.depositBg,
                            color: "var(--ink)",
                          }}
                        >
                          <span
                            className="ep-flag"
                            style={{ backgroundImage: `url(${c.flagUrl})` }}
                            aria-hidden
                          />
                          <span>{c.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {p.depositRailHasChoice ? (
                    <div className="ep-money-field">
                      <span className="ep-money-label" id="deposit-rail-label">
                        Funding rail
                      </span>
                      <div
                        className="ep-chip-row"
                        role="group"
                        aria-labelledby="deposit-rail-label"
                      >
                        {(p.depositRailChips || []).map((r: any, i: number) => (
                          <button
                            key={i}
                            type="button"
                            onClick={r.select}
                            className="ep-money-choice ep-money-choice--rail"
                            style={{ background: r.bg, color: r.color }}
                          >
                            {r.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {p.depositProviderHasChoice ? (
                    <div className="ep-money-field">
                      <span className="ep-money-label" id="deposit-provider-label">
                        Choose provider
                      </span>
                      <div
                        className="ep-chip-row ep-chip-row--scroll"
                        role="group"
                        aria-labelledby="deposit-provider-label"
                      >
                        {(p.depositProviderChips || []).map((pr: any, i: number) => (
                          <button
                            key={i}
                            type="button"
                            onClick={pr.select}
                            className="ep-money-choice ep-money-choice--rail ep-money-choice--outlined"
                            style={{
                              borderColor: pr.border,
                              background: pr.bg,
                              color: "var(--ink)",
                            }}
                          >
                            {pr.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </>
              ) : null}

              {p.depositIsCrypto ? (
                <>
                  <div className="ep-money-row-between">
                    <span className="ep-money-label" id="deposit-asset-label">
                      Asset
                    </span>
                    <div
                      className="ep-money-segment"
                      role="group"
                      aria-labelledby="deposit-asset-label"
                    >
                      {(p.depositAssets || []).map((as: any, i: number) => (
                        <button
                          key={i}
                          type="button"
                          onClick={as.select}
                          className="ep-money-segment__btn"
                          style={{ background: as.bg, color: as.color }}
                        >
                          {as.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="ep-money-field">
                    <span className="ep-money-label" id="deposit-network-label">
                      Network
                    </span>
                    <div
                      className="ep-chip-row"
                      role="group"
                      aria-labelledby="deposit-network-label"
                    >
                      {(p.depositNetworks || []).map((net: any, i: number) => (
                        <button
                          key={i}
                          type="button"
                          onClick={net.select}
                          className="ep-money-choice ep-money-choice--rail ep-money-choice--outlined"
                          style={{
                            borderColor: net.border,
                            background: net.bg,
                            color: net.color,
                          }}
                        >
                          {net.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              ) : null}

              <button type="button" className="ep-btn-primary" onClick={p.depositNext}>
                Continue
              </button>
            </div>
          ) : null}

          {p.depositStepIs2 && p.depositIsCountry ? (
            <div className="ep-money-section">
              <span className="ep-money-step-label">Step 2 · Amount & source account</span>
              <div className="ep-money-summary">{p.depositDestinationSummary}</div>

              <div className="ep-money-field">
                <label className="ep-money-label" htmlFor="deposit-amount">
                  {p.depositAmountLabel}
                </label>
                <input
                  id="deposit-amount"
                  className="ep-money-input ep-money-input--amount"
                  value={p.depositAmount}
                  onChange={p.setDepositAmount}
                  placeholder="0.00"
                  inputMode="decimal"
                  autoComplete="off"
                  aria-describedby={p.depositQuoteError ? "deposit-quote-error" : undefined}
                />
              </div>

              <div className="ep-money-field">
                <label className="ep-money-label" htmlFor="deposit-payer">
                  {p.depositPayerLabel}
                </label>
                {p.depositIsMobileRail ? (
                  <div className="ep-money-phone">
                    <span className="ep-money-phone__code" aria-hidden>
                      {p.depositMobileCode}
                    </span>
                    <input
                      id="deposit-payer"
                      className="ep-money-input--bare"
                      value={p.depositPhone}
                      onChange={p.setDepositPhone}
                      placeholder={p.depositPayerPlaceholder}
                      inputMode="tel"
                      autoComplete="tel"
                      aria-label={`${p.depositPayerLabel}, country code ${p.depositMobileCode}`}
                    />
                  </div>
                ) : (
                  <input
                    id="deposit-payer"
                    className="ep-money-input"
                    value={p.depositPhone}
                    onChange={p.setDepositPhone}
                    placeholder={p.depositPayerPlaceholder}
                    autoComplete="off"
                  />
                )}
              </div>

              {p.depositQuoteError ? (
                <div
                  id="deposit-quote-error"
                  className="ep-money-alert ep-money-alert--error"
                  role="alert"
                >
                  {p.depositQuoteError}
                </div>
              ) : null}

              <div className="ep-money-actions">
                <button type="button" className="ep-btn-secondary" onClick={p.depositBack}>
                  Back
                </button>
                <button
                  type="button"
                  className="ep-btn-primary"
                  onClick={p.depositNext}
                  disabled={p.depositQuoteLoading}
                  aria-busy={p.depositQuoteLoading || undefined}
                >
                  {p.depositQuoteLoading ? "Getting quote…" : "Review"}
                </button>
              </div>
            </div>
          ) : null}

          {p.depositStepIs2 && p.depositIsCrypto ? (
            <div className="ep-money-section">
              <span className="ep-money-step-label">Step 2 · {p.depositDestinationSummary}</span>
              <div className="ep-money-alert ep-money-alert--error" role="note">
                Only send {p.depositAssetCode} on {p.depositNetworkLabel} — other networks cannot be
                recovered.
              </div>

              {hasAddress ? (
                <div className="ep-money-address">
                  <span className="ep-money-address__value" id="deposit-address-value">
                    {p.depositAddress}
                  </span>
                  <button
                    type="button"
                    className="ep-money-copy"
                    onClick={copyDepositAddress}
                    aria-describedby="deposit-address-value"
                  >
                    {addressCopied ? "Copied" : "Copy"}
                  </button>
                </div>
              ) : (
                <div className="ep-money-empty" role="status">
                  Deposit address unavailable. Connect a treasury wallet or try again later.
                </div>
              )}

              <button type="button" className="ep-btn-secondary" onClick={p.depositBack}>
                Back
              </button>
            </div>
          ) : null}

          {p.depositStepIs3 ? (
            <div className="ep-money-section ep-money-section--tight">
              <span className="ep-money-step-label">Step 3 · Review & confirm</span>
              <div className="ep-money-review" role="group" aria-label="Deposit summary">
                <div className="ep-money-review__row">
                  <span className="ep-money-review__key">From</span>
                  <span className="ep-money-review__val">
                    {p.depositIsMobileRail
                      ? `${p.depositMobileCode} ${p.depositPhone}`.trim()
                      : p.depositPhone}
                  </span>
                </div>
                <div className="ep-money-review__row">
                  <span className="ep-money-review__key">Via</span>
                  <span className="ep-money-review__val">{p.depositDestinationSummary}</span>
                </div>
                <div className="ep-money-review__row">
                  <span className="ep-money-review__key">You pay</span>
                  <span className="ep-money-review__val ep-money-review__val--mono">
                    {p.depositAmount}
                  </span>
                </div>
                {p.depositQuoteRateText ? (
                  <div className="ep-money-review__row">
                    <span className="ep-money-review__key">You receive</span>
                    <span className="ep-money-review__val ep-money-review__val--mono">
                      {p.depositQuoteRateText}
                    </span>
                  </div>
                ) : null}
                <div className="ep-money-review__row">
                  <span className="ep-money-review__key">Fee</span>
                  <span className="ep-money-review__val ep-money-review__val--mono">
                    {p.depositFeeText}
                  </span>
                </div>
                <div className="ep-money-review__row">
                  <span className="ep-money-review__key">Valid until</span>
                  <span className="ep-money-review__val">{p.depositArrivalText}</span>
                </div>
              </div>

              {p.depositAcceptError ? (
                <div className="ep-money-alert ep-money-alert--error" role="alert">
                  {p.depositAcceptError}
                </div>
              ) : null}

              <div className="ep-money-actions">
                <button
                  type="button"
                  className="ep-btn-secondary"
                  onClick={p.depositBack}
                  disabled={p.depositAccepting}
                >
                  Back
                </button>
                <button
                  type="button"
                  className="ep-btn-primary"
                  onClick={p.submitDeposit}
                  disabled={p.depositAccepting}
                  aria-busy={p.depositAccepting || undefined}
                >
                  {p.depositAccepting ? "Confirming…" : "Confirm top-up ↗"}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {p.depositDone ? (
        <div className="ep-money-success">
          <span className="ep-money-success__icon" aria-hidden>
            ✓
          </span>
          <span className="ep-money-success__title">Top-up started</span>
          <span className="ep-money-success__body">{p.depositResultText}</span>

          {p.depositLiveStatus ? (
            <span
              className="ep-money-status"
              style={{ background: p.depositLiveStatus.soft, color: p.depositLiveStatus.color }}
              role="status"
            >
              {p.depositLiveStatus.isSettling ? (
                <span className="ep-money-status__dot" aria-hidden />
              ) : null}
              {p.depositLiveStatus.label}
            </span>
          ) : null}

          {p.depositIsMobileRail && p.depositPromptSent ? (
            <div className="ep-money-followup">
              <div className="ep-money-followup__title">
                <span className="ep-money-followup__pulse" aria-hidden />
                <span>Check your phone</span>
              </div>
              <p className="ep-money-lede">
                Enter your PIN to approve the {p.depositOperator} prompt sent to{" "}
                {p.depositMobileCode} {p.depositPhone}.
              </p>
            </div>
          ) : null}

          {p.depositIsBankRail && p.depositBankLines.length > 0 ? (
            <div className="ep-money-followup">
              <p className="ep-money-lede">
                {p.depositBankLabel} via {p.depositOperator} · {p.depositBankArrival}
              </p>
              <div className="ep-money-acct" role="group" aria-label="Bank transfer details">
                {(p.depositBankLines || []).map((ln: any, i: number) => (
                  <div key={i} className="ep-money-acct__row">
                    <span className="ep-money-acct__key">{ln.k}</span>
                    <span className="ep-money-acct__val">{ln.v}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <button
            type="button"
            className="ep-btn-secondary"
            onClick={p.closeModal}
            style={{ width: "auto", minWidth: 120 }}
          >
            Done
          </button>
        </div>
      ) : null}
    </>
  );
}
