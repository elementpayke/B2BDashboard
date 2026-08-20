"use client";
import React, { useEffect, useId, useRef, useState } from "react";
import MbokaMark from "@/components/brand/MbokaMark";
import ChoicePicker from "@/components/ui/ChoicePicker";
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
  /** Country group on a bank rail — drives the "Bank" field on step 2. */
  sendIsBankRail: boolean;
  /** Corridor is running on standby providers — shows the rerouting note. */
  sendProvidersAreFallback: boolean;
  /** No aggregator institution id for this corridor — the quote cannot succeed. */
  sendBlockedNoNetworkId: boolean;
  /** Currency the amount box is being typed in — "USD" or the destination's. */
  sendAmountCurrency: string;
  /** What actually leaves, from the quote's `user_pays` once one exists. */
  sendYouPayText: string;
  sendLocalCurrency: string;
  /** False when we hold no rate for the corridor, so USD is the only option. */
  sendCanEnterLocal: boolean;
  setSendAmountCurrency: (currency: string) => void;
  /** "≈ 130,500.00 KES" — indicative, pre-quote. Null when no rate. */
  sendAmountEquivalent: string | null;
  /** Indicative "1 USD = 130.50 KES" shown while entering an amount. */
  sendIndicativeRateLine: string | null;
  /** Binding "1 USD = 130.50 KES" from the quote, shown on review. */
  sendQuotedRateLine: string | null;
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
  /** When mobile money — rewrite local 07… to +254… (E.164) on blur. */
  normalizeSendRecipientPhone?: (e?: React.FocusEvent<HTMLInputElement>) => void;
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

function SendProviderPicker({
  id,
  label,
  title,
  catalogBusy,
  sendProviderIdx,
  sendProviderOptions,
  selectSendProvider,
}: {
  id: string;
  label: string;
  title: string;
  catalogBusy: boolean;
  sendProviderIdx: number;
  sendProviderOptions: string[];
  selectSendProvider: (index: number) => void;
}) {
  return (
    <ChoicePicker
      id={id}
      label={label}
      title={title}
      value={String(sendProviderIdx)}
      options={(sendProviderOptions || []).map((name, i) => ({
        value: String(i),
        label: name,
      }))}
      onChange={(value) => selectSendProvider(Number(value))}
      disabled={catalogBusy || (sendProviderOptions || []).length === 0}
      loading={catalogBusy && (sendProviderOptions || []).length === 0}
      loadingLabel="Loading providers…"
      searchable
    />
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

          {p.sendStepIs1 ? (
            <div className="ep-money-stack">
              <span className="ep-money-step-label">Step 1 · Where is this going?</span>

              {p.sendIsCountry ? (
                <>
                  <div className="ep-send-recipient__card" role="group" aria-label="Destination">
                    <ChoicePicker
                      id="send-country"
                      label="Destination country"
                      title="Choose country"
                      value={String(p.sendCountryIdx)}
                      options={(p.sendCountryChips || []).map((c: any) => ({
                        value: String(c.idx),
                        label: c.name,
                        leading: c.flagUrl ? (
                          <span
                            className="ep-money-flag"
                            style={{ backgroundImage: `url(${c.flagUrl})` }}
                            aria-hidden
                          />
                        ) : undefined,
                      }))}
                      onChange={(value) => p.selectSendCountry(Number(value))}
                    />
                    <div className="ep-money-field">
                      <span className="ep-money-label" id="send-currency-label">
                        Currency
                      </span>
                      <div
                        className="ep-send-recipient__readonly"
                        role="status"
                        aria-labelledby="send-currency-label"
                      >
                        {p.sendCountryFlagUrl ? (
                          <span
                            className="ep-money-flag ep-send-recipient__select-flag"
                            style={{ backgroundImage: `url(${p.sendCountryFlagUrl})` }}
                            aria-hidden
                          />
                        ) : null}
                        <span className="ep-send-recipient__readonly-text">
                          <strong>{p.sendCurrencyCode}</strong>
                          {p.sendCurrencyName ? (
                            <span className="ep-send-recipient__readonly-muted">
                              {" "}
                              {p.sendCurrencyName}
                            </span>
                          ) : null}
                        </span>
                      </div>
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
                            aria-pressed={r.selected}
                            style={{ background: r.bg, color: r.color }}
                          >
                            {r.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {catalogBusy || (p.sendProviderOptions || []).length > 0 ? (
                    <SendProviderPicker
                      id="send-provider-1"
                      label={p.sendProviderLabel}
                      title={`Choose ${p.sendProviderLabel.toLowerCase()}`}
                      catalogBusy={catalogBusy}
                      sendProviderIdx={p.sendProviderIdx}
                      sendProviderOptions={p.sendProviderOptions || []}
                      selectSendProvider={p.selectSendProvider}
                    />
                  ) : null}

                  {/* 5c · Routing — the block holds while providers rotate
                      behind it. Reliability is the point: the corridor is
                      still open, only the provider list moved. */}
                  {p.sendBlockedNoNetworkId ? (
                    <div className="ep-money-rerouting" role="alert">
                      <MbokaMark size={18} motion="routing" title={null} />
                      <span>
                        We can&apos;t price this corridor right now — our provider list is
                        unavailable, so there is no route to send on. Please try again shortly.
                      </span>
                    </div>
                  ) : p.sendProvidersAreFallback ? (
                    <div className="ep-money-rerouting" role="note">
                      <MbokaMark size={18} motion="routing" title={null} />
                      <span>
                        Live provider data isn&apos;t available for this corridor right now —
                        routing through standby providers.
                      </span>
                    </div>
                  ) : null}
                </>
              ) : (
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
                          aria-pressed={as.selected}
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
                          aria-pressed={ch.selected}
                          style={{ borderColor: ch.border, background: ch.bg, color: ch.color }}
                        >
                          {ch.label}
                        </button>
                      ))}
                    </div>
                    <div className="ep-money-banner ep-money-banner--warn">
                      Double-check the recipient accepts {p.sendAssetCode} on {p.sendChainLabel} —
                      sending to the wrong network can lose funds.
                    </div>
                  </div>
                </>
              )}

              {p.sendQuoteError && !p.sendBlockedNoNetworkId ? (
                <div className="ep-money-banner ep-money-banner--danger" role="alert">
                  {p.sendQuoteError}
                </div>
              ) : null}

              <button
                type="button"
                className="ep-btn-primary"
                onClick={p.sendNext}
                disabled={catalogBusy || p.sendBlockedNoNetworkId}
                aria-busy={catalogBusy || undefined}
              >
                {catalogBusy ? "Loading providers…" : "Continue"}
              </button>
            </div>
          ) : null}

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

                {/* Bank rails repeat the institution picker here, per the design.
                    Mobile rails pick their operator on step 1 only. Both write
                    the same provider index — the aggregator takes one id. */}
                {p.sendIsBankRail &&
                (catalogBusy || (p.sendProviderOptions || []).length > 0) ? (
                  <SendProviderPicker
                    id="send-provider"
                    label="Bank"
                    title="Choose bank"
                    catalogBusy={catalogBusy}
                    sendProviderIdx={p.sendProviderIdx}
                    sendProviderOptions={p.sendProviderOptions || []}
                    selectSendProvider={p.selectSendProvider}
                  />
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
                    onBlur={p.normalizeSendRecipientPhone}
                    placeholder={p.sendRecipientPlaceholder}
                    autoComplete="off"
                    spellCheck={false}
                    inputMode={
                      p.sendRecipientLabel?.toLowerCase().includes("phone") ||
                      p.sendRecipientLabel?.toLowerCase().includes("mobile")
                        ? "tel"
                        : undefined
                    }
                  />
                  {!p.sendIsCrypto &&
                  (p.sendRecipientLabel?.toLowerCase().includes("phone") ||
                    p.sendRecipientLabel?.toLowerCase().includes("mobile")) ? (
                    <span className="ep-money-hint ep-money-hint--inline">
                      Local numbers like 07… convert to international format (e.g. +254…) when you
                      leave the field.
                    </span>
                  ) : null}
                </div>

                <div className="ep-money-field">
                  <div className="ep-money-label-row">
                    <label className="ep-money-label" htmlFor="send-amount">
                      Amount ({p.sendAmountCurrency})
                    </label>
                    {p.sendCanEnterLocal ? (
                      <div
                        className="ep-money-seg ep-money-seg--sm"
                        role="group"
                        aria-label="Amount currency"
                      >
                        {Array.from(new Set(["USD", p.sendLocalCurrency])).map((code) => (
                          <button
                            key={code}
                            type="button"
                            className="ep-money-seg__btn"
                            aria-pressed={p.sendAmountCurrency === code}
                            onClick={() => p.setSendAmountCurrency(code)}
                            style={{
                              background:
                                p.sendAmountCurrency === code ? "var(--ink)" : "transparent",
                              color: p.sendAmountCurrency === code ? "var(--bg)" : "var(--ink)",
                            }}
                          >
                            {code}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <input
                    id="send-amount"
                    className="ep-money-input ep-money-input--amount"
                    value={p.sendAmount}
                    onChange={p.setSendAmount}
                    placeholder="0.00"
                    inputMode="decimal"
                    autoComplete="off"
                    aria-describedby={
                      p.sendQuoteError
                        ? "send-quote-error"
                        : p.sendAmountEquivalent
                          ? "send-amount-equiv"
                          : undefined
                    }
                  />
                  {p.sendAmountEquivalent ? (
                    <span className="ep-money-equiv" id="send-amount-equiv">
                      <strong>{p.sendAmountEquivalent}</strong>
                      {p.sendIndicativeRateLine ? ` · ${p.sendIndicativeRateLine}` : ""}
                      <span className="ep-money-equiv__note">
                        Indicative. The exact amount is locked on the next step.
                      </span>
                    </span>
                  ) : null}
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
              <span className="ep-money-step-label">Step 3 · Review & confirm</span>
              <div className="ep-money-review" role="group" aria-label="Payment summary">
                <div className="ep-money-review__row">
                  <span className="ep-money-review__k">To</span>
                  <span className="ep-money-review__v">{p.sendRecipient}</span>
                </div>
                {p.sendIsCountry ? (
                  <div className="ep-money-review__row">
                    <span className="ep-money-review__k">Holder</span>
                    <span className="ep-money-review__v">{p.sendRecipientName}</span>
                  </div>
                ) : null}
                {p.sendIsBankRail ? (
                  <div className="ep-money-review__row">
                    <span className="ep-money-review__k">Method</span>
                    <span className="ep-money-review__v">Bank transfer</span>
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
                  <span className="ep-money-review__k">You send</span>
                  <span className="ep-money-review__v ep-money-review__v--mono">
                    {p.sendYouPayText}
                  </span>
                </div>
                {p.sendQuoteRateText ? (
                  <div className="ep-money-review__row ep-money-review__row--emphasis">
                    <span className="ep-money-review__k">Recipient gets</span>
                    <span className="ep-money-review__v ep-money-review__v--mono">
                      {p.sendQuoteRateText}
                    </span>
                  </div>
                ) : null}
                {p.sendQuotedRateLine ? (
                  <div className="ep-money-review__row">
                    <span className="ep-money-review__k">Rate</span>
                    <span className="ep-money-review__v ep-money-review__v--mono">
                      {p.sendQuotedRateLine}
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
                  {p.sendAccepting ? (
                    <span className="ep-btn-busy">
                      <MbokaMark size={16} motion="inflight" tone="inverse" title={null} />
                      Sending…
                    </span>
                  ) : (
                    "Confirm & send ↗"
                  )}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {p.sendDone ? (
        <div className="ep-money-success">
          <MbokaMark
            size={48}
            motion={p.sendLiveStatus?.isSettling ? "inflight" : "settlement"}
            title={null}
          />
          <span className="ep-money-success__title">Payment on its way</span>
          <span className="ep-money-success__body">
            {p.sendResultText || `${p.sendYouPayText} to ${p.sendRecipient} · ${p.sendArrivalText}`}
          </span>
          {p.sendLiveStatus ? (
            <span
              className="ep-money-status"
              style={{ background: p.sendLiveStatus.soft, color: p.sendLiveStatus.color }}
              role="status"
            >
              {p.sendLiveStatus.isSettling ? (
                <MbokaMark size={14} motion="inflight" tone="mono" title={null} />
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
