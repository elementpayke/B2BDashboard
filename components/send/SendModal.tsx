"use client";
import React from "react";

/** Presentational Send modal body — props-driven; state lives in DashboardApp. */
export type SendModalProps = {
  sendNotDone: boolean;
  sendDone: boolean;
  sendStepDots: { on: boolean }[];
  sendStepIs1: boolean;
  sendStepIs2: boolean;
  sendStepIs3: boolean;
  sendGroups: any[];
  sendIsCountry: boolean;
  sendIsCrypto: boolean;
  sendCountryChips: any[];
  sendRailHasChoice: boolean;
  sendRailChips: any[];
  sendProviderHasChoice: boolean;
  sendProviderChips: any[];
  /** True while GET /v1/supported/catalog has not settled — hide hardcoded chips. */
  sendCatalogLoading: boolean;
  sendAssets: any[];
  sendChains: any[];
  sendAssetCode: string;
  sendChainLabel: string;
  sendNext: () => void;
  sendBack: () => void;
  sendDestinationSummary: string;
  sendRecipientName: string;
  setSendRecipientName: (e: React.ChangeEvent<HTMLInputElement>) => void;
  sendRecipientLabel: string;
  sendRecipient: string;
  setSendRecipient: (e: React.ChangeEvent<HTMLInputElement>) => void;
  sendRecipientPlaceholder: string;
  sendAmount: string;
  setSendAmount: (e: React.ChangeEvent<HTMLInputElement>) => void;
  sendQuoteError: string;
  sendQuoteLoading: boolean;
  sendQuoteRateText: string | null;
  sendFeeText: string;
  sendArrivalText: string;
  sendAcceptError: string;
  sendAccepting: boolean;
  submitSend: () => void;
  sendResultText: string | null;
  /** Live order status (polled via lib/hooks/useOrderStatus), null for the simulated stablecoin tab. */
  sendLiveStatus: { label: string; color: string; soft: string; isSettling: boolean } | null;
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

export default function SendModal(p: SendModalProps) {
  const catalogBusy = p.sendIsCountry && p.sendCatalogLoading;

  return (
    <>
      {p.sendNotDone ? (
        <div className="ep-money-flow">
          <StepProgress dots={p.sendStepDots || []} label="Send payment progress" />

          {p.sendStepIs1 ? (
            <div className="ep-money-section">
              <span className="ep-money-step-label">Step 1 · Where is this going?</span>
              <div className="ep-chip-row" role="group" aria-label="Destination type">
                {(p.sendGroups || []).map((g: any, i: number) => (
                  <button
                    key={i}
                    type="button"
                    onClick={g.select}
                    className="ep-money-choice"
                    style={{ background: g.bg, color: g.color }}
                  >
                    {g.label}
                  </button>
                ))}
              </div>

              {p.sendIsCountry ? (
                <>
                  <div className="ep-money-field">
                    <span className="ep-money-label" id="send-country-label">
                      Recipient&apos;s country
                    </span>
                    <div
                      className="ep-chip-row ep-chip-row--scroll"
                      role="group"
                      aria-labelledby="send-country-label"
                    >
                      {(p.sendCountryChips || []).map((c: any, i: number) => (
                        <button
                          key={i}
                          type="button"
                          onClick={c.selectSend}
                          className="ep-money-choice ep-money-choice--flag ep-money-choice--outlined"
                          style={{
                            borderColor: c.sendBorder,
                            background: c.sendBg,
                            color: "var(--ink)",
                          }}
                        >
                          <span
                            className="ep-flag"
                            style={{ backgroundImage: `url(${c.flagUrl})` }}
                            aria-hidden
                          />
                          <span>{c.code}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {p.sendRailHasChoice ? (
                    <div className="ep-money-field">
                      <span className="ep-money-label" id="send-rail-label">
                        Payout rail
                      </span>
                      <div className="ep-chip-row" role="group" aria-labelledby="send-rail-label">
                        {(p.sendRailChips || []).map((r: any, i: number) => (
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

                  {p.sendCatalogLoading ? (
                    <div className="ep-money-alert ep-money-alert--info" role="status">
                      Loading providers…
                    </div>
                  ) : null}

                  {!p.sendCatalogLoading && p.sendProviderHasChoice ? (
                    <div className="ep-money-field">
                      <span className="ep-money-label" id="send-provider-label">
                        Choose provider
                      </span>
                      <div
                        className="ep-chip-row ep-chip-row--scroll"
                        role="group"
                        aria-labelledby="send-provider-label"
                      >
                        {(p.sendProviderChips || []).map((pr: any, i: number) => (
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

              {p.sendIsCrypto ? (
                <>
                  <p className="ep-money-lede">
                    Sends stablecoin directly on-chain — no bank or mobile money involved.
                  </p>
                  <div className="ep-money-field">
                    <span className="ep-money-label" id="send-asset-label">
                      Asset
                    </span>
                    <div
                      className="ep-money-segment"
                      role="group"
                      aria-labelledby="send-asset-label"
                    >
                      {(p.sendAssets || []).map((as: any, i: number) => (
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
                    <span className="ep-money-label" id="send-chain-label">
                      Confirm the chain you&apos;re sending to
                    </span>
                    <div className="ep-chip-row" role="group" aria-labelledby="send-chain-label">
                      {(p.sendChains || []).map((ch: any, i: number) => (
                        <button
                          key={i}
                          type="button"
                          onClick={ch.select}
                          className="ep-money-choice ep-money-choice--rail ep-money-choice--outlined"
                          style={{
                            borderColor: ch.border,
                            background: ch.bg,
                            color: ch.color,
                          }}
                        >
                          {ch.label}
                        </button>
                      ))}
                    </div>
                    <div className="ep-money-alert ep-money-alert--warn" role="note">
                      Double-check the recipient accepts {p.sendAssetCode} on {p.sendChainLabel} —
                      sending to the wrong network can lose funds.
                    </div>
                  </div>
                </>
              ) : null}

              {p.sendQuoteError && p.sendIsCrypto ? (
                <div className="ep-money-alert ep-money-alert--error" role="alert">
                  {p.sendQuoteError}
                </div>
              ) : null}

              <button
                type="button"
                className="ep-btn-primary"
                onClick={p.sendNext}
                disabled={catalogBusy}
                aria-busy={catalogBusy || undefined}
              >
                {catalogBusy ? "Loading…" : "Continue"}
              </button>
            </div>
          ) : null}

          {p.sendStepIs2 ? (
            <div className="ep-money-section">
              <span className="ep-money-step-label">Step 2 · Recipient & amount</span>
              <div className="ep-money-summary">{p.sendDestinationSummary}</div>

              {p.sendIsCountry ? (
                <div className="ep-money-field">
                  <label className="ep-money-label" htmlFor="send-recipient-name">
                    Recipient&apos;s name
                  </label>
                  <input
                    id="send-recipient-name"
                    className="ep-money-input"
                    value={p.sendRecipientName}
                    onChange={p.setSendRecipientName}
                    placeholder="e.g. Jane Mukami"
                    autoComplete="name"
                  />
                </div>
              ) : null}

              <div className="ep-money-field">
                <label className="ep-money-label" htmlFor="send-recipient">
                  {p.sendRecipientLabel}
                </label>
                <input
                  id="send-recipient"
                  className="ep-money-input"
                  value={p.sendRecipient}
                  onChange={p.setSendRecipient}
                  placeholder={p.sendRecipientPlaceholder}
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>

              <div className="ep-money-field">
                <label className="ep-money-label" htmlFor="send-amount">
                  Amount (USD)
                </label>
                <input
                  id="send-amount"
                  className="ep-money-input ep-money-input--amount"
                  value={p.sendAmount}
                  onChange={p.setSendAmount}
                  placeholder="0.00"
                  inputMode="decimal"
                  autoComplete="off"
                  aria-describedby={p.sendQuoteError ? "send-quote-error" : undefined}
                />
              </div>

              {p.sendQuoteError ? (
                <div id="send-quote-error" className="ep-money-alert ep-money-alert--error" role="alert">
                  {p.sendQuoteError}
                </div>
              ) : null}

              <div className="ep-money-actions">
                <button type="button" className="ep-btn-secondary" onClick={p.sendBack}>
                  Back
                </button>
                <button
                  type="button"
                  className="ep-btn-primary"
                  onClick={p.sendNext}
                  disabled={p.sendQuoteLoading}
                  aria-busy={p.sendQuoteLoading || undefined}
                >
                  {p.sendQuoteLoading ? "Getting quote…" : "Review"}
                </button>
              </div>
            </div>
          ) : null}

          {p.sendStepIs3 ? (
            <div className="ep-money-section ep-money-section--tight">
              <span className="ep-money-step-label">Step 3 · Review & confirm</span>
              <div className="ep-money-review" role="group" aria-label="Payment summary">
                <div className="ep-money-review__row">
                  <span className="ep-money-review__key">To</span>
                  <span className="ep-money-review__val">{p.sendRecipient}</span>
                </div>
                <div className="ep-money-review__row">
                  <span className="ep-money-review__key">Via</span>
                  <span className="ep-money-review__val">{p.sendDestinationSummary}</span>
                </div>
                {p.sendIsCrypto ? (
                  <div className="ep-money-review__row">
                    <span className="ep-money-review__key">Network</span>
                    <span className="ep-money-review__val">{p.sendChainLabel}</span>
                  </div>
                ) : null}
                <div className="ep-money-review__row">
                  <span className="ep-money-review__key">You send</span>
                  <span className="ep-money-review__val ep-money-review__val--mono">
                    ${p.sendAmount} USD
                  </span>
                </div>
                {p.sendQuoteRateText ? (
                  <div className="ep-money-review__row">
                    <span className="ep-money-review__key">Recipient gets</span>
                    <span className="ep-money-review__val ep-money-review__val--mono">
                      {p.sendQuoteRateText}
                    </span>
                  </div>
                ) : null}
                <div className="ep-money-review__row">
                  <span className="ep-money-review__key">Fee</span>
                  <span className="ep-money-review__val ep-money-review__val--mono">{p.sendFeeText}</span>
                </div>
                <div className="ep-money-review__row">
                  <span className="ep-money-review__key">Arrival</span>
                  <span className="ep-money-review__val">{p.sendArrivalText}</span>
                </div>
              </div>

              {p.sendAcceptError ? (
                <div className="ep-money-alert ep-money-alert--error" role="alert">
                  {p.sendAcceptError}
                </div>
              ) : null}

              <div className="ep-money-actions">
                <button
                  type="button"
                  className="ep-btn-secondary"
                  onClick={p.sendBack}
                  disabled={p.sendAccepting}
                >
                  Back
                </button>
                <button
                  type="button"
                  className="ep-btn-primary"
                  onClick={p.submitSend}
                  disabled={p.sendAccepting}
                  aria-busy={p.sendAccepting || undefined}
                >
                  {p.sendAccepting ? "Sending…" : "Confirm & send ↗"}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {p.sendDone ? (
        <div className="ep-money-success">
          <span className="ep-money-success__icon" aria-hidden>
            ✓
          </span>
          <span className="ep-money-success__title">Payment on its way</span>
          <span className="ep-money-success__body">
            {p.sendResultText || `$${p.sendAmount} USD to ${p.sendRecipient} · ${p.sendArrivalText}`}
          </span>
          {p.sendLiveStatus ? (
            <span
              className="ep-money-status"
              style={{ background: p.sendLiveStatus.soft, color: p.sendLiveStatus.color }}
              role="status"
            >
              {p.sendLiveStatus.isSettling ? (
                <span className="ep-money-status__dot" aria-hidden />
              ) : null}
              {p.sendLiveStatus.label}
            </span>
          ) : null}
          <button type="button" className="ep-btn-secondary" onClick={p.closeModal} style={{ width: "auto", minWidth: 120 }}>
            Done
          </button>
        </div>
      ) : null}
    </>
  );
}
