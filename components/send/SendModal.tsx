"use client";
import React from "react";

/** Presentational Send modal body — props-driven; state lives in DashboardApp. */
export type SendModalProps = {
  sendNotDone: boolean;
  sendDone: boolean;
  sendMethod: "bank" | "mobile" | "crypto" | "internal" | null;
  selectSendMethod: (method: "bank" | "mobile" | "crypto" | "internal") => () => void;
  resetSendMethod: () => void;
  sendStepDots: { on: boolean }[];
  sendStepIs1: boolean;
  sendStepIs2: boolean;
  sendStepIs3: boolean;
  sendIsCountry: boolean;
  sendIsCrypto: boolean;
  sendIsInternal: boolean;
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
  /** Own accounts for the internal-transfer picker (presentation). */
  internalAccounts: {
    key?: string;
    label: string;
    code: string;
    flagUrl: string | null;
    select: () => void;
    selected: boolean;
  }[];
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
  const firstOff = dots.findIndex((d) => !d.on);
  const step = dots.every((d) => d.on) ? dots.length : Math.max(1, firstOff);
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

const METHODS: {
  key: "bank" | "mobile" | "crypto" | "internal";
  title: string;
  desc: string;
  disabled?: boolean;
  icon: React.ReactNode;
}[] = [
  {
    key: "bank",
    title: "Bank transfer",
    desc: "Send to a bank account, locally or internationally",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M3 21h18M4 10h16M5 10l7-6 7 6M6 10v11M18 10v11M10 10v11M14 10v11"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    key: "mobile",
    title: "Mobile money",
    desc: "Send to a mobile money wallet across Africa",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="7" y="2" width="10" height="20" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
        <path d="M11 18h2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    key: "crypto",
    title: "Stablecoin",
    desc: "Send USDC or USDT to a wallet address",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" />
        <path
          d="M12 7v10M9.5 9.5c0-1 1-1.6 2.5-1.6s2.5.7 2.5 1.7-1 1.5-2.5 1.5-2.5.6-2.5 1.6 1 1.7 2.5 1.7 2.5-.6 2.5-1.6"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    key: "internal",
    title: "Internal transfer",
    desc: "Coming soon — move funds between your own accounts",
    disabled: true,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M4 8h13l-3-3M20 16H7l3 3"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
];

export default function SendModal(p: SendModalProps) {
  const catalogBusy = p.sendIsCountry && p.sendCatalogLoading;
  const methodChosen = p.sendMethod != null;

  return (
    <>
      {p.sendNotDone ? (
        <div className="ep-money-flow">
          {!methodChosen ? (
            <div className="ep-send-methods">
              <p className="ep-send-methods__intro">How would you like to send?</p>
              {METHODS.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  className="ep-send-methods__row"
                  onClick={m.disabled ? undefined : p.selectSendMethod(m.key)}
                  disabled={m.disabled}
                  aria-disabled={m.disabled || undefined}
                >
                  <span className="ep-send-methods__icon">{m.icon}</span>
                  <span className="ep-send-methods__copy">
                    <span className="ep-send-methods__title">{m.title}</span>
                    <span className="ep-send-methods__desc">{m.desc}</span>
                  </span>
                  {!m.disabled ? (
                    <span className="ep-send-methods__chev" aria-hidden>
                      ›
                    </span>
                  ) : (
                    <span className="ep-send-methods__soon">Soon</span>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <>
              <button type="button" className="ep-money-change-method" onClick={p.resetSendMethod}>
                ← Change method
              </button>
              <StepProgress dots={p.sendStepDots || []} label="Send payment progress" />

              {p.sendStepIs1 ? (
                <div className="ep-money-stack">
                  <span className="ep-money-step-label">Step 1 · Where is this going?</span>

                  {p.sendIsInternal ? (
                    <>
                      <p className="ep-money-hint">Choose one of your accounts to receive the transfer.</p>
                      <div className="ep-send-internal" role="group" aria-label="Your accounts">
                        {(p.internalAccounts || []).map((a, i) => (
                          <button
                            key={a.key ?? `${a.code}-${i}`}
                            type="button"
                            className="ep-send-internal__row"
                            data-selected={a.selected ? "true" : "false"}
                            aria-pressed={a.selected}
                            onClick={a.select}
                          >
                            {a.flagUrl ? (
                              <span
                                className="ep-money-flag"
                                style={{ backgroundImage: `url(${a.flagUrl})` }}
                                aria-hidden
                              />
                            ) : (
                              <span className="ep-send-internal__glyph" aria-hidden>
                                ◈
                              </span>
                            )}
                            <span className="ep-send-internal__label">{a.label}</span>
                            <span className="ep-send-internal__code">{a.code}</span>
                          </button>
                        ))}
                      </div>
                      <div className="ep-money-banner ep-money-banner--muted" role="note">
                        Internal transfers between your own accounts aren’t available yet.
                      </div>
                    </>
                  ) : null}

                  {p.sendIsCountry ? (
                    <>
                      <div className="ep-money-field">
                        <span className="ep-money-label" id="send-country-label">
                          Destination country
                        </span>
                        <div
                          className="ep-money-scroll"
                          role="group"
                          aria-labelledby="send-country-label"
                        >
                          {(p.sendCountryChips || []).map((c: any, i: number) => (
                            <button
                              key={i}
                              type="button"
                              onClick={c.selectSend}
                              className="ep-money-chip"
                              style={{
                                borderColor: c.sendBorder,
                                background: c.sendBg,
                              }}
                            >
                              <span
                                className="ep-money-flag"
                                style={{ backgroundImage: `url(${c.flagUrl})` }}
                                aria-hidden
                              />
                              <span className="ep-money-chip__code">{c.code}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {p.sendRailHasChoice ? (
                        <div className="ep-money-field">
                          <span className="ep-money-label" id="send-rail-label">
                            Payout rail
                          </span>
                          <div className="ep-money-tabs" role="group" aria-labelledby="send-rail-label">
                            {(p.sendRailChips || []).map((r: any, i: number) => (
                              <button
                                key={i}
                                type="button"
                                onClick={r.select}
                                className="ep-money-rail"
                                style={{ background: r.bg, color: r.color }}
                              >
                                {r.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {p.sendCatalogLoading ? (
                        <div className="ep-money-banner ep-money-banner--muted" role="status">
                          Loading providers…
                        </div>
                      ) : null}

                      {!p.sendCatalogLoading && p.sendProviderHasChoice ? (
                        <div className="ep-money-field">
                          <span className="ep-money-label" id="send-provider-label">
                            Choose provider
                          </span>
                          <div
                            className="ep-money-scroll"
                            role="group"
                            aria-labelledby="send-provider-label"
                          >
                            {(p.sendProviderChips || []).map((pr: any, i: number) => (
                              <button
                                key={i}
                                type="button"
                                onClick={pr.select}
                                className="ep-money-provider"
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
                      <p className="ep-money-hint">
                        Sends stablecoin directly on-chain — no bank or mobile money involved.
                      </p>
                      <div className="ep-money-field">
                        <span className="ep-money-label" id="send-asset-label">
                          Asset
                        </span>
                        <div className="ep-money-seg" role="group" aria-labelledby="send-asset-label">
                          {(p.sendAssets || []).map((as: any, i: number) => (
                            <button
                              key={i}
                              type="button"
                              onClick={as.select}
                              className="ep-money-seg__btn"
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
                        <div
                          className="ep-money-tabs ep-money-tabs--wrap"
                          role="group"
                          aria-labelledby="send-chain-label"
                        >
                          {(p.sendChains || []).map((ch: any, i: number) => (
                            <button
                              key={i}
                              type="button"
                              onClick={ch.select}
                              className="ep-money-network"
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
                        <div className="ep-money-banner ep-money-banner--warn" role="note">
                          Double-check the recipient accepts {p.sendAssetCode} on {p.sendChainLabel} —
                          sending to the wrong network can lose funds.
                        </div>
                      </div>
                    </>
                  ) : null}

                  {p.sendQuoteError && p.sendIsCrypto ? (
                    <div className="ep-money-banner ep-money-banner--danger" role="alert">
                      {p.sendQuoteError}
                    </div>
                  ) : null}

                  {!p.sendIsInternal ? (
                    <button
                      type="button"
                      className="ep-btn-primary"
                      onClick={p.sendNext}
                      disabled={catalogBusy}
                      aria-busy={catalogBusy || undefined}
                    >
                      {catalogBusy ? "Loading…" : "Continue"}
                    </button>
                  ) : null}
                </div>
              ) : null}

              {p.sendStepIs2 ? (
                <div className="ep-money-stack">
                  <span className="ep-money-step-label">Step 2 · Recipient details</span>
                  <div className="ep-money-banner ep-money-banner--info">{p.sendDestinationSummary}</div>

                  {p.sendIsCountry ? (
                    <div className="ep-money-field">
                      <label className="ep-money-label" htmlFor="send-recipient-name">
                        Account holder name
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
                    <div
                      id="send-quote-error"
                      className="ep-money-banner ep-money-banner--danger"
                      role="alert"
                    >
                      {p.sendQuoteError}
                    </div>
                  ) : null}

                  <div className="ep-money-actions">
                    <button type="button" className="ep-btn-secondary" onClick={p.sendBack}>
                      ← Back
                    </button>
                    <button
                      type="button"
                      className="ep-btn-primary ep-btn-primary--ink"
                      onClick={p.sendNext}
                      disabled={p.sendQuoteLoading}
                      aria-busy={p.sendQuoteLoading || undefined}
                    >
                      {p.sendQuoteLoading ? "Getting quote…" : "Save details"}
                    </button>
                  </div>
                </div>
              ) : null}

              {p.sendStepIs3 ? (
                <div className="ep-money-stack ep-money-stack--tight">
                  <span className="ep-money-step-label">Step 3 · Review & confirm</span>
                  <div className="ep-money-review" role="group" aria-label="Payment summary">
                    <div className="ep-money-review__row">
                      <span className="ep-money-review__k">To</span>
                      <span className="ep-money-review__v">{p.sendRecipient}</span>
                    </div>
                    {p.sendIsCountry && p.sendRecipientName ? (
                      <div className="ep-money-review__row">
                        <span className="ep-money-review__k">Holder</span>
                        <span className="ep-money-review__v">{p.sendRecipientName}</span>
                      </div>
                    ) : null}
                    <div className="ep-money-review__row">
                      <span className="ep-money-review__k">Via</span>
                      <span className="ep-money-review__v">{p.sendDestinationSummary}</span>
                    </div>
                    {p.sendIsCrypto ? (
                      <div className="ep-money-review__row">
                        <span className="ep-money-review__k">Network</span>
                        <span className="ep-money-review__v">{p.sendChainLabel}</span>
                      </div>
                    ) : null}
                    <div className="ep-money-review__row ep-money-review__row--emphasis">
                      <span className="ep-money-review__k">Amount</span>
                      <span className="ep-money-review__v ep-money-review__v--mono">
                        ${p.sendAmount} USD
                      </span>
                    </div>
                    {p.sendQuoteRateText ? (
                      <div className="ep-money-review__row">
                        <span className="ep-money-review__k">Recipient gets</span>
                        <span className="ep-money-review__v ep-money-review__v--mono">
                          {p.sendQuoteRateText}
                        </span>
                      </div>
                    ) : null}
                    <div className="ep-money-review__row">
                      <span className="ep-money-review__k">Fee</span>
                      <span className="ep-money-review__v ep-money-review__v--mono">{p.sendFeeText}</span>
                    </div>
                    <div className="ep-money-review__row">
                      <span className="ep-money-review__k">Arrival</span>
                      <span className="ep-money-review__v">{p.sendArrivalText}</span>
                    </div>
                  </div>

                  {p.sendAcceptError ? (
                    <div className="ep-money-banner ep-money-banner--danger" role="alert">
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
                      ← Back
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
            </>
          )}
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
