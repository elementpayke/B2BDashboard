"use client";
import MbokaMark from "@/components/brand/MbokaMark";
import ChoicePicker, { type ChoicePickerOption } from "@/components/ui/ChoicePicker";
import DepositAddressQr from "@/components/wallets/DepositAddressQr";
import React, { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  countryMatchesQuery,
} from "@/lib/hooks/depositFlowHelpers";
import { isStellarUsdcRail } from "@/lib/stellar/network";

const StellarWalletDeposit = dynamic(() => import("@/components/wallets/StellarWalletDeposit"), {
  ssr: false,
});

export type DepositCountryRow = {
  idx: number;
  name: string;
  code: string;
  flagUrl: string | null;
  railsLabel: string;
  searchText: string;
  select: () => void;
};

export type DepositMethodOption = {
  name: string;
  selected: boolean;
  select: () => void;
};

export type DepositMethodGroup = {
  railIdx: number;
  type: string;
  label: string;
  providers: DepositMethodOption[];
};

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
  depositSub: "country" | "method";
  depositCountryRows: DepositCountryRow[];
  depositMethodGroups: DepositMethodGroup[];
  depositSelectedCountryName: string;
  depositMethodChosen: boolean;
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
  depositNetwork: string;
  depositNetworkLabel: string;
  depositAddress: string;
  depositAddressEmptyMessage?: string;
  closeModal: () => void;
  /** When funding a fiat account via African OnRamp → USDC (best-effort convert). */
  fundTargetCurrency?: string | null;
  fundConvertStatus?: string;
  fundConvertError?: string;
  /** Destination stablecoin wallet — mirrors Send’s refund-wallet picker. */
  depositWalletOptions?: ChoicePickerOption[];
  depositWalletId?: string;
  selectDepositWallet?: (accountId: string) => void;
  depositWalletsLoading?: boolean;
  /** Account-detail fund: destination wallet is already pinned. */
  depositWalletLocked?: boolean;
  depositWalletLabel?: string | null;
};

function SearchField({
  id,
  value,
  onChange,
  placeholder,
  label,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
}) {
  return (
    <label className="ep-pick-search" htmlFor={id}>
      <span className="ep-pick-search__icon" aria-hidden>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.2-3.2" />
        </svg>
      </span>
      <span className="ep-sr-only">{label}</span>
      <input
        id={id}
        className="ep-pick-search__input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
      />
    </label>
  );
}

function MethodIcon({ type }: { type: string }) {
  if (type === "mobile") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
        <rect x="7" y="2" width="10" height="20" rx="2.5" />
        <path d="M11 18h2" />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M3 21h18M4 10h16M5 10l7-6 7 6M6 10v11M18 10v11M10 10v11M14 10v11" />
    </svg>
  );
}

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

export default function DepositModal(p: DepositModalProps) {
  const [addressCopied, setAddressCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [countrySearch, setCountrySearch] = useState("");
  const hasAddress = Boolean(p.depositAddress && p.depositAddress !== "—");

  const filteredCountries = useMemo(
    () => (p.depositCountryRows || []).filter((row) => countryMatchesQuery(row.searchText, countrySearch)),
    [p.depositCountryRows, countrySearch],
  );

  const showContinue =
    (p.depositIsCrypto ||
      (p.depositIsCountry && p.depositSub === "method" && p.depositMethodChosen)) &&
    Boolean(p.depositWalletId || (p.depositWalletLocked && p.depositWalletLabel));

  const copyDepositAddress = async () => {
    if (!hasAddress) return;
    setCopyError(null);
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard unavailable");
      }
      await navigator.clipboard.writeText(p.depositAddress);
      setAddressCopied(true);
      window.setTimeout(() => setAddressCopied(false), 1800);
    } catch {
      setAddressCopied(false);
      setCopyError("Couldn't copy. Select the address and copy it manually.");
    }
  };

  return (
    <>
      {p.depositNotDone ? (
        <div className="ep-money-flow">
          <StepProgress dots={p.depositStepDots || []} label="Deposit progress" />

          {p.fundTargetCurrency ? (
            <>
              <div className="ep-money-banner ep-money-banner--info" role="note">
                Paying African fiat → USDC, then we try USDC → {p.fundTargetCurrency} (best effort).
                {p.fundConvertStatus ? ` ${p.fundConvertStatus}` : ""}
              </div>
              {p.fundConvertError ? (
                <div className="ep-money-banner ep-money-banner--danger" role="alert">
                  {p.fundConvertError}
                </div>
              ) : null}
            </>
          ) : null}

          {p.depositStepIs1 ? (
            <div className="ep-money-stack">
              <span className="ep-money-step-label">
                {p.fundTargetCurrency
                  ? "Step 1 · Where is this coming from?"
                  : p.depositIsCountry && p.depositSub === "method"
                    ? "Step 1 · How will you pay?"
                    : "Step 1 · How are you topping up?"}
              </span>
              {p.fundTargetCurrency ? null : (
              <div className="ep-money-tabs" role="group" aria-label="Deposit method">
                {(p.depositMethods || []).map((dm: any, i: number) => (
                  <button
                    key={i}
                    type="button"
                    onClick={dm.select}
                    className="ep-money-tab"
                    style={{ background: dm.bg, color: dm.color }}
                  >
                    {dm.label}
                  </button>
                ))}
              </div>
              )}

              {p.depositWalletLocked && p.depositWalletLabel ? (
                <div className="ep-money-banner ep-money-banner--info" role="note">
                  Top up to {p.depositWalletLabel}
                </div>
              ) : p.selectDepositWallet &&
                (p.depositWalletsLoading || (p.depositWalletOptions || []).length > 0) ? (
                <ChoicePicker
                  id="deposit-target-wallet"
                  label="Top up to wallet"
                  title="Choose wallet"
                  value={p.depositWalletId || ""}
                  options={p.depositWalletOptions || []}
                  onChange={p.selectDepositWallet}
                  loading={p.depositWalletsLoading}
                  loadingLabel="Loading wallets…"
                  placeholder="Select a ready stablecoin wallet"
                />
              ) : (
                <p className="ep-money-hint">
                  No ready stablecoin wallet yet. Open a USDC account under Accounts and wait until
                  it is active with a deposit address.
                </p>
              )}

              {p.depositIsCountry && p.depositSub === "country" ? (
                <>
                  <SearchField
                    id="deposit-country-search"
                    value={countrySearch}
                    onChange={setCountrySearch}
                    placeholder="Search country or currency"
                    label="Search country or currency"
                  />
                  <div className="ep-pick-list" role="listbox" aria-label="Source country">
                    {filteredCountries.length === 0 ? (
                      <p className="ep-money-empty">No countries match that search.</p>
                    ) : (
                      filteredCountries.map((c) => (
                        <button
                          key={c.idx}
                          type="button"
                          role="option"
                          className="ep-pick-row"
                          onClick={c.select}
                        >
                          <span
                            className="ep-pick-row__flag"
                            style={c.flagUrl ? { backgroundImage: `url(${c.flagUrl})` } : undefined}
                            aria-hidden
                          />
                          <span className="ep-pick-row__text">
                            <span className="ep-pick-row__title">{c.name}</span>
                            <span className="ep-pick-row__meta">{c.railsLabel}</span>
                          </span>
                          <span className="ep-pick-row__code">{c.code}</span>
                          <span className="ep-pick-row__chev" aria-hidden>
                            ›
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </>
              ) : null}

              {p.depositIsCountry && p.depositSub === "method" ? (
                <>
                  <button type="button" className="ep-money-back-link" onClick={p.depositBack}>
                    ← {p.depositSelectedCountryName || "Countries"}
                  </button>
                  <div className="ep-pick-list" role="listbox" aria-label="Funding method">
                    {(p.depositMethodGroups || []).map((group) => {
                      const first = group.providers[0];
                      const selected = group.providers.some((pr) => pr.selected);
                      return (
                        <button
                          key={group.railIdx}
                          type="button"
                          role="option"
                          aria-selected={selected}
                          disabled={!first}
                          className={`ep-pick-row${selected ? " ep-pick-row--selected" : ""}`}
                          onClick={first?.select}
                        >
                          <span className="ep-pick-group__icon" aria-hidden>
                            <MethodIcon type={group.type} />
                          </span>
                          <span className="ep-pick-row__text">
                            <span className="ep-pick-row__title">{group.label}</span>
                          </span>
                          {selected ? (
                            <span className="ep-pick-row__check" aria-hidden>
                              ✓
                            </span>
                          ) : (
                            <span className="ep-pick-row__chev" aria-hidden>
                              ›
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : null}

              {p.depositIsCrypto ? (
                <>
                  <div className="ep-money-asset-row">
                    <span className="ep-money-label" id="deposit-asset-label">
                      Asset
                    </span>
                    <div
                      className="ep-money-seg"
                      role="group"
                      aria-labelledby="deposit-asset-label"
                    >
                      {(p.depositAssets || []).map((as: any, i: number) => (
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
                    <span className="ep-money-label" id="deposit-network-label">
                      Network
                    </span>
                    <div
                      className="ep-money-tabs ep-money-tabs--wrap"
                      role="group"
                      aria-labelledby="deposit-network-label"
                    >
                      {(p.depositNetworks || []).map((net: any, i: number) => (
                        <button
                          key={i}
                          type="button"
                          onClick={net.select}
                          className="ep-money-network"
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

              {showContinue ? (
              <button type="button" className="ep-btn-primary" onClick={p.depositNext}>
                Continue
              </button>
              ) : null}
            </div>
          ) : null}

          {p.depositStepIs2 && p.depositIsCountry ? (
            <div className="ep-money-stack">
              <span className="ep-money-step-label">Step 2 · Amount & source account</span>
              <div className="ep-money-banner ep-money-banner--info">
                {p.depositDestinationSummary}
              </div>

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
                  className="ep-money-banner ep-money-banner--danger"
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
            <div className="ep-money-stack">
              <span className="ep-money-step-label">Step 2 · {p.depositDestinationSummary}</span>
              <div className="ep-money-banner ep-money-banner--danger" role="note">
                Only send {p.depositAssetCode} on {p.depositNetworkLabel} — other networks cannot be
                recovered.
              </div>

              {hasAddress ? (
                <div className="ep-money-stack ep-money-stack--tight">
                  <div className="ep-money-copy-row">
                    <span className="ep-money-copy-row__value" id="deposit-address-value">
                      {p.depositAddress}
                    </span>
                    <button
                      type="button"
                      className="ep-money-copy-btn"
                      onClick={copyDepositAddress}
                      aria-describedby="deposit-address-value"
                      aria-label={addressCopied ? "Address copied" : "Copy deposit address"}
                    >
                      {addressCopied ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <DepositAddressQr
                    address={p.depositAddress}
                    currency={p.depositAssetCode}
                    network={p.depositNetwork}
                    networkLabel={p.depositNetworkLabel}
                  />
                  {copyError ? (
                    <div className="ep-money-banner ep-money-banner--danger" role="alert">
                      {copyError}
                    </div>
                  ) : null}
                  {addressCopied ? (
                    <span className="ep-money-hint" role="status" aria-live="polite">
                      Address copied to clipboard.
                    </span>
                  ) : null}
                  {isStellarUsdcRail({
                    network: p.depositNetwork,
                    currency: p.depositAssetCode,
                  }) ? (
                    <StellarWalletDeposit
                      destination={p.depositAddress}
                      network={p.depositNetwork}
                      suggestedAmount=""
                    />
                  ) : null}
                </div>
              ) : (
                <div className="ep-money-empty" role="status">
                  {p.depositAddressEmptyMessage ||
                    "Deposit address unavailable. Open a ready wallet on this network or try again later."}
                </div>
              )}

              <button type="button" className="ep-btn-secondary" onClick={p.depositBack}>
                Back
              </button>
            </div>
          ) : null}

          {p.depositStepIs3 ? (
            <div className="ep-money-stack ep-money-stack--tight">
              <span className="ep-money-step-label">Step 3 · Review & confirm</span>
              <div className="ep-money-review" role="group" aria-label="Deposit summary">
                <div className="ep-money-review__row">
                  <span className="ep-money-review__k">From</span>
                  <span className="ep-money-review__v">
                    {p.depositIsMobileRail
                      ? `${p.depositMobileCode} ${p.depositPhone}`.trim()
                      : p.depositPhone}
                  </span>
                </div>
                {p.depositWalletLabel ? (
                  <div className="ep-money-review__row">
                    <span className="ep-money-review__k">To</span>
                    <span className="ep-money-review__v">{p.depositWalletLabel}</span>
                  </div>
                ) : null}
                <div className="ep-money-review__row">
                  <span className="ep-money-review__k">Via</span>
                  <span className="ep-money-review__v">{p.depositDestinationSummary}</span>
                </div>
                <div className="ep-money-review__row ep-money-review__row--emphasis">
                  <span className="ep-money-review__k">You pay</span>
                  <span className="ep-money-review__v ep-money-review__v--mono">
                    {p.depositAmount}
                  </span>
                </div>
                {p.depositQuoteRateText ? (
                  <div className="ep-money-review__row">
                    <span className="ep-money-review__k">You receive</span>
                    <span className="ep-money-review__v ep-money-review__v--mono">
                      {p.depositQuoteRateText}
                    </span>
                  </div>
                ) : null}
                <div className="ep-money-review__row">
                  <span className="ep-money-review__k">Fee</span>
                  <span className="ep-money-review__v ep-money-review__v--mono">
                    {p.depositFeeText}
                  </span>
                </div>
                <div className="ep-money-review__row">
                  <span className="ep-money-review__k">Valid until</span>
                  <span className="ep-money-review__v">{p.depositArrivalText}</span>
                </div>
              </div>

              {p.depositAcceptError ? (
                <div className="ep-money-banner ep-money-banner--danger" role="alert">
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
          <MbokaMark
            size={48}
            motion={p.depositLiveStatus?.isSettling ? "inflight" : "settlement"}
            title={null}
          />
          <span className="ep-money-success__title">Top-up started</span>
          <span className="ep-money-success__body">{p.depositResultText}</span>

          {p.depositLiveStatus ? (
            <span
              className="ep-money-status"
              style={{ background: p.depositLiveStatus.soft, color: p.depositLiveStatus.color }}
              role="status"
            >
              {p.depositLiveStatus.isSettling ? (
                <MbokaMark size={14} motion="inflight" tone="mono" title={null} />
              ) : null}
              {p.depositLiveStatus.label}
            </span>
          ) : null}

          {p.fundTargetCurrency && (p.fundConvertStatus || p.fundConvertError) ? (
            <div className="ep-fund-orch-note" role="status">
              <strong>Auto-convert to {p.fundTargetCurrency}</strong>
              {p.fundConvertStatus ? (
                <span className="ep-fund-orch-note__status">{p.fundConvertStatus}</span>
              ) : null}
              {p.fundConvertError ? (
                <span className="ep-fund-orch-note__err" role="alert">
                  {p.fundConvertError}
                </span>
              ) : null}
            </div>
          ) : null}

          {p.depositIsMobileRail && p.depositPromptSent ? (
            <div className="ep-money-done-panel">
              <div className="ep-money-done-panel__title">
                <span className="ep-money-done-panel__dot" aria-hidden />
                <span>Check your phone</span>
              </div>
              <p className="ep-money-hint">
                Enter your PIN to approve the mobile money prompt sent to{" "}
                {p.depositMobileCode} {p.depositPhone}.
              </p>
            </div>
          ) : null}

          {p.depositIsBankRail && p.depositBankLines.length > 0 ? (
            <div className="ep-money-done-panel">
              <p className="ep-money-hint">
                {p.depositBankLabel} · {p.depositBankArrival}
              </p>
              <div className="ep-money-kv" role="group" aria-label="Bank transfer details">
                {(p.depositBankLines || []).map((ln: any, i: number) => (
                  <div key={i} className="ep-money-kv__row">
                    <span className="ep-money-kv__k">{ln.k}</span>
                    <span className="ep-money-kv__v">{ln.v}</span>
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
