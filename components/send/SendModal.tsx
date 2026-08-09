"use client";
import React, { useEffect, useId, useRef, useState } from "react";
import {
  formatSavedRecipientSubtitle,
  type SavedRecipient,
} from "@/lib/clients/savedRecipientsApi";

/** Presentational Send modal body — props-driven; state lives in DashboardApp. */
export type SendMethodOption = {
  key: string;
  label: string;
  desc: string;
  disabled?: boolean;
  disabledReason?: string;
  select: () => void;
};

export type SendModalProps = {
  sendNotDone: boolean;
  sendDone: boolean;
  /** False until a send method is picked — the flow opens on the chooser. */
  sendMethodChosen: boolean;
  sendMethodOptions: SendMethodOption[];
  resetSendMethod: () => void;
  sendStepDots: { on: boolean }[];
  sendStepIs1: boolean;
  sendStepIs2: boolean;
  sendStepIs3: boolean;
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
  /** Destination summary for the recipient-details layout */
  sendCountryName: string;
  sendCountryFlagUrl: string | null;
  sendCurrencyCode: string;
  sendCurrencyName: string;
  /** Country index into COUNTRIES — for destination select on recipient step. */
  sendCountryIdx: number;
  selectSendCountry: (index: number) => void;
  sendProviderLabel: string;
  sendProviderOptions: string[];
  selectSendProvider: (index: number) => void;
  sendProviderIdx: number;
  savedRecipients: SavedRecipient[];
  savedRecipientsLoading?: boolean;
  onSelectSavedRecipient: (recipient: SavedRecipient) => void;
  onSaveRecipientDetails: () => void;
  saveRecipientBusy?: boolean;
  saveRecipientMessage?: string;
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

const METHOD_ICONS: Record<string, React.ReactNode> = {
  bank: (
    <path d="M3 21h18M4 10h16M5 10l7-6 7 6M6 10v11M18 10v11M10 10v11M14 10v11" />
  ),
  mobile: (
    <>
      <rect x="7" y="2" width="10" height="20" rx="2.5" />
      <path d="M11 18h2" />
    </>
  ),
  crypto: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v10M9.5 9.5c0-1 1-1.6 2.5-1.6s2.5.7 2.5 1.7-1 1.5-2.5 1.5-2.5.6-2.5 1.6 1 1.7 2.5 1.7 2.5-.6 2.5-1.6" />
    </>
  ),
  internal: <path d="M4 8h13l-3-3M20 16H7l3 3" />,
};

function SavedRecipientPicker({
  recipients,
  loading,
  onSelect,
}: {
  recipients: SavedRecipient[];
  loading?: boolean;
  onSelect: (r: SavedRecipient) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="ep-send-saved" ref={rootRef}>
      <button
        type="button"
        className="ep-send-saved__trigger"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="ep-send-saved__trigger-label">
          {loading ? "Loading saved details…" : "Select from saved details"}
        </span>
        <span className="ep-send-saved__chev" aria-hidden>
          {open ? "▴" : "▾"}
        </span>
      </button>
      {open ? (
        <div
          id={listId}
          className="ep-send-saved__menu"
          role="listbox"
          aria-label="Saved recipients"
        >
          {(recipients || []).length === 0 ? (
            <p className="ep-send-saved__empty">No saved recipients yet. Fill the form and tap Save details.</p>
          ) : (
            recipients.map((r) => (
              <button
                key={r.id}
                type="button"
                role="option"
                className="ep-send-saved__option"
                onClick={() => {
                  onSelect(r);
                  setOpen(false);
                }}
              >
                <span className="ep-send-saved__option-name">{r.label}</span>
                <span className="ep-send-saved__option-meta">{formatSavedRecipientSubtitle(r)}</span>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

export default function SendModal(p: SendModalProps) {
  const catalogBusy = p.sendIsCountry && p.sendCatalogLoading;
  const canSaveDetails =
    Boolean(p.sendRecipient.trim()) &&
    (p.sendIsCrypto || Boolean(p.sendRecipientName.trim()));

  return (
    <>
      {p.sendNotDone && !p.sendMethodChosen ? (
        <div className="ep-money-stack">
          <p className="ep-money-hint">How would you like to send?</p>
          {(p.sendMethodOptions || []).map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={m.select}
              className="ep-send-method"
              disabled={m.disabled}
              title={m.disabled ? m.disabledReason : undefined}
            >
              <span className="ep-send-method__icon" aria-hidden>
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  {METHOD_ICONS[m.key]}
                </svg>
              </span>
              <span className="ep-send-method__text">
                <span className="ep-send-method__label">{m.label}</span>
                <span className="ep-send-method__desc">
                  {m.disabled && m.disabledReason ? m.disabledReason : m.desc}
                </span>
              </span>
              {!m.disabled ? (
                <span className="ep-send-method__chevron" aria-hidden>
                  ›
                </span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}

      {p.sendNotDone && p.sendMethodChosen ? (
        <div className="ep-money-flow">
          <button type="button" className="ep-money-back-link" onClick={p.resetSendMethod}>
            ← Change method
          </button>
          <StepProgress dots={p.sendStepDots || []} label="Send payment progress" />

          {/* Destination (country/provider) lives on recipient details — no separate chip step. */}

          {p.sendStepIs2 ? (
            <div className="ep-money-stack ep-send-recipient">
              <div className="ep-send-recipient__hero">
                <h4 className="ep-send-recipient__title">Recipient details</h4>
                <p className="ep-send-recipient__subtitle">{p.sendDestinationSummary}</p>
              </div>

              <SavedRecipientPicker
                recipients={p.savedRecipients || []}
                loading={p.savedRecipientsLoading}
                onSelect={p.onSelectSavedRecipient}
              />

              <div className="ep-send-recipient__card" role="group" aria-label="Destination">
                {p.sendIsCountry ? (
                  <>
                    <div className="ep-money-field">
                      <label className="ep-money-label" htmlFor="send-dest-country">
                        Destination country
                      </label>
                      <div className="ep-send-recipient__select-wrap ep-send-recipient__select-wrap--leading">
                        {p.sendCountryFlagUrl ? (
                          <span
                            className="ep-money-flag ep-send-recipient__select-flag"
                            style={{ backgroundImage: `url(${p.sendCountryFlagUrl})` }}
                            aria-hidden
                          />
                        ) : null}
                        <select
                          id="send-dest-country"
                          className="ep-money-input ep-send-recipient__select"
                          value={String(p.sendCountryIdx)}
                          onChange={(e) => p.selectSendCountry(Number(e.target.value))}
                        >
                          {(p.sendCountryChips || []).map((c: any) => (
                            <option key={c.idx} value={c.idx}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="ep-money-field">
                      <label className="ep-money-label" htmlFor="send-dest-currency">
                        Currency
                      </label>
                      <div className="ep-send-recipient__select-wrap ep-send-recipient__select-wrap--leading">
                        {p.sendCountryFlagUrl ? (
                          <span
                            className="ep-money-flag ep-send-recipient__select-flag"
                            style={{ backgroundImage: `url(${p.sendCountryFlagUrl})` }}
                            aria-hidden
                          />
                        ) : null}
                        <select
                          id="send-dest-currency"
                          className="ep-money-input ep-send-recipient__select"
                          value={String(p.sendCountryIdx)}
                          onChange={(e) => p.selectSendCountry(Number(e.target.value))}
                          aria-label="Currency"
                        >
                          {(p.sendCountryChips || []).map((c: any) => (
                            <option key={`ccy-${c.idx}`} value={c.idx}>
                              {c.code} · {c.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="ep-money-field">
                      <span className="ep-money-label" id="send-asset-label-r">
                        Asset
                      </span>
                      <div className="ep-money-seg" role="group" aria-labelledby="send-asset-label-r">
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
                      <span className="ep-money-label" id="send-chain-label-r">
                        Network
                      </span>
                      <div
                        className="ep-money-tabs ep-money-tabs--wrap"
                        role="group"
                        aria-labelledby="send-chain-label-r"
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
                    </div>
                  </>
                )}
              </div>

              <div className="ep-send-recipient__card" role="group" aria-label="Recipient">
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

                {p.sendIsCountry && (p.sendProviderOptions || []).length > 0 ? (
                  <div className="ep-money-field">
                    <label className="ep-money-label" htmlFor="send-provider">
                      {p.sendRecipientLabel?.toLowerCase().includes("phone") ||
                      p.sendRecipientLabel?.toLowerCase().includes("mobile")
                        ? "Provider"
                        : "Bank"}
                    </label>
                    <div className="ep-send-recipient__select-wrap">
                      <select
                        id="send-provider"
                        className="ep-money-input ep-send-recipient__select"
                        value={String(p.sendProviderIdx)}
                        onChange={(e) => p.selectSendProvider(Number(e.target.value))}
                      >
                        {(p.sendProviderOptions || []).map((name, i) => (
                          <option key={`${name}-${i}`} value={i}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ) : null}

                <div className="ep-money-field">
                  <label className="ep-money-label" htmlFor="send-recipient">
                    {p.sendIsCrypto
                      ? "Recipient wallet address"
                      : p.sendRecipientLabel || "Recipient account number"}
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

              {p.saveRecipientMessage ? (
                <div className="ep-money-banner ep-money-banner--info" role="status">
                  {p.saveRecipientMessage}
                </div>
              ) : null}

              <div className="ep-money-actions ep-send-recipient__actions">
                <button type="button" className="ep-btn-secondary" onClick={p.sendBack}>
                  ← Back
                </button>
                <button
                  type="button"
                  className="ep-btn-secondary"
                  onClick={p.onSaveRecipientDetails}
                  disabled={!canSaveDetails || p.saveRecipientBusy}
                  aria-busy={p.saveRecipientBusy || undefined}
                >
                  {p.saveRecipientBusy ? "Saving…" : "Save details"}
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
            <div className="ep-money-stack ep-money-stack--tight">
              <span className="ep-money-step-label">Step 2 · Review & confirm</span>
              <div className="ep-money-review" role="group" aria-label="Payment summary">
                <div className="ep-money-review__row">
                  <span className="ep-money-review__k">To</span>
                  <span className="ep-money-review__v">{p.sendRecipient}</span>
                </div>
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
                  <span className="ep-money-review__k">You send</span>
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
