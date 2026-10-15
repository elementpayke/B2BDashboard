"use client";
import MbokaMark from "@/components/brand/MbokaMark";
import ChoicePicker, { type ChoicePickerOption } from "@/components/ui/ChoicePicker";
import NetworkPickList from "@/components/brand/NetworkPickList";
import DepositAddressQr from "@/components/wallets/DepositAddressQr";
import React, { useEffect, useMemo, useState } from "react";
import BankTransferInstructions from "@/components/deposit/BankTransferInstructions";
import { formatCountdown } from "@/lib/services/transferTerms";
import TermsLine from "@/components/money/TermsLine";
import dynamic from "next/dynamic";
import {
  countryMatchesQuery,
} from "@/lib/hooks/depositFlowHelpers";
import { isMobileMoneyRail } from "@/lib/services/mobileMoneyBrands";
import MobileMoneyMark from "@/components/money/MobileMoneyMark";
import { settlesAsUsdcOnStellar } from "@/lib/config/stellarFeatures";
import { isStellarNetwork, shouldOfferStellarWalletDeposit } from "@/lib/stellar/network";

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
  /** Short label for mobile-money operators (e.g. "M-Pesa"). */
  displayLabel?: string;
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
  /** True while supported-catalog is loading with no corridors yet. */
  depositCatalogLoading?: boolean;
  depositCatalogError?: string | null;
  onRetryDepositCatalog?: () => void;
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
  /** "Min KES 100 · Max KES 150,000" from the partner catalog; null when unpublished. */
  depositLimitsText?: string | null;
  /** Inline message when the typed amount is outside the published limits. */
  depositLimitError?: string | null;
  /** "1 USD = 129.50 KES" from the quote. */
  depositRateLine?: string | null;
  /** Quote expiry (ISO) for the rate-lock countdown. */
  depositQuoteExpiresAt?: string | null;
  /** Currency the payer sends in (e.g. KES). */
  depositCurrency?: string;
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
  /** Offer Create Account when this rail has no ready wallet yet. */
  depositCreateAccount?: (() => void) | null;
  depositCreateAccountLabel?: string;
  closeModal: () => void;
  /** When funding a fiat account via African OnRamp → stable → fiat VA (background). */
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

function formatPayAmount(raw: string): string {
  const n = Number(String(raw).replace(/,/g, ""));
  return Number.isFinite(n) && n > 0
    ? new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(n)
    : raw;
}

/** Ticks every second while a quote is on screen so the rate lock counts down. */
function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [active]);
  return now;
}

export default function DepositModal(p: DepositModalProps) {
  const now = useNow(Boolean(p.depositStepIs3 && p.depositQuoteExpiresAt));
  const quoteCountdown = formatCountdown(p.depositQuoteExpiresAt, now);
  const quoteExpired = quoteCountdown === "0:00";
  const showBankPay = p.depositIsBankRail && (p.depositBankLines || []).length > 0;
  const [addressCopied, setAddressCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [countrySearch, setCountrySearch] = useState("");
  // Same as Receive: this wallet is dedicated, not pooled, so nothing routed
  // here ever needs a memo — purely a reference tag for the depositor's own
  // records, carried through the QR for wallets that support it.
  const [depositMemo, setDepositMemo] = useState("");
  const [depositMemoCopied, setDepositMemoCopied] = useState(false);
  const copyDepositMemo = async () => {
    const value = depositMemo.trim();
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setDepositMemoCopied(true);
      window.setTimeout(() => setDepositMemoCopied(false), 1800);
    } catch {
      setDepositMemoCopied(false);
    }
  };
  const hasAddress = Boolean(p.depositAddress && p.depositAddress !== "—");
  const stellarSettlementHint = settlesAsUsdcOnStellar(
    p.depositAssetCode,
    p.depositNetwork,
  );

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
                Paying African fiat → {p.depositAssetCode || "stablecoin"}, then we convert to{" "}
                {p.fundTargetCurrency} in the background (may take 1–2 min while{" "}
                {p.depositAssetCode || "stablecoin"} reflects).
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
                  {p.depositCatalogLoading && filteredCountries.length === 0 ? (
                    <p className="ep-money-empty" role="status">
                      Loading countries…
                    </p>
                  ) : p.depositCatalogError && filteredCountries.length === 0 && !countrySearch.trim() ? (
                    <div className="ep-money-empty-stack" role="alert">
                      <p className="ep-money-empty">
                        Couldn&apos;t load countries. {p.depositCatalogError}
                      </p>
                      {p.onRetryDepositCatalog ? (
                        <button
                          type="button"
                          className="ep-btn-primary"
                          onClick={p.onRetryDepositCatalog}
                        >
                          Retry
                        </button>
                      ) : null}
                    </div>
                  ) : (
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
                  )}
                </>
              ) : null}

              {p.depositIsCountry && p.depositSub === "method" ? (
                <>
                  <button type="button" className="ep-money-back-link" onClick={p.depositBack}>
                    ← {p.depositSelectedCountryName || "Countries"}
                  </button>
                  <div className="ep-pick-list" role="listbox" aria-label="Funding method">
                    {(p.depositMethodGroups || []).flatMap((group) => {
                      if (isMobileMoneyRail(group.type)) {
                        return group.providers.map((pr) => (
                          <button
                            key={`${group.railIdx}-${pr.name}`}
                            type="button"
                            role="option"
                            aria-selected={pr.selected}
                            className={`ep-pick-row${pr.selected ? " ep-pick-row--selected" : ""}`}
                            onClick={pr.select}
                          >
                            <span className="ep-pick-row__mark" aria-hidden>
                              <MobileMoneyMark name={pr.name} size={32} />
                            </span>
                            <span className="ep-pick-row__text">
                              <span className="ep-pick-row__title">
                                {pr.displayLabel || pr.name}
                              </span>
                              <span className="ep-pick-row__meta">Mobile money</span>
                            </span>
                            {pr.selected ? (
                              <span className="ep-pick-row__check" aria-hidden>
                                ✓
                              </span>
                            ) : (
                              <span className="ep-pick-row__chev" aria-hidden>
                                ›
                              </span>
                            )}
                          </button>
                        ));
                      }

                      const first = group.providers[0];
                      const selected = group.providers.some((pr) => pr.selected);
                      return [
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
                        </button>,
                      ];
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
                    <NetworkPickList
                      items={p.depositNetworks || []}
                      ariaLabel="Choose network"
                    />
                  </div>
                </>
              ) : null}

              {showContinue ? (
              <div className="ep-money-flow__cta">
              <button type="button" className="ep-btn-primary" onClick={p.depositNext}>
                Continue
              </button>
              </div>
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
                  aria-invalid={p.depositLimitError ? true : undefined}
                  aria-describedby={
                    [
                      p.depositLimitsText || p.depositLimitError ? "deposit-limits" : "",
                      p.depositQuoteError ? "deposit-quote-error" : "",
                    ]
                      .filter(Boolean)
                      .join(" ") || undefined
                  }
                />
                <TermsLine
                  id="deposit-limits"
                  limits={p.depositLimitsText}
                  error={p.depositLimitError}
                  fee={p.depositFeeText}
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

              <div className="ep-money-actions ep-money-flow__cta">
                <button type="button" className="ep-btn-secondary" onClick={p.depositBack}>
                  Back
                </button>
                <button
                  type="button"
                  className="ep-btn-primary"
                  onClick={p.depositNext}
                  disabled={p.depositQuoteLoading || Boolean(p.depositLimitError)}
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
              {stellarSettlementHint ? (
                <p className="ep-money-hint">
                  Deposits on this Stellar {p.depositAssetCode} rail settle as USDC after arrival.
                </p>
              ) : null}

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

                  {isStellarNetwork(p.depositNetwork) ? (
                    <div className="ep-money-field">
                      <label className="ep-money-label" htmlFor="deposit-memo">
                        Reference memo (optional)
                      </label>
                      <input
                        id="deposit-memo"
                        className="ep-money-input"
                        value={depositMemo}
                        onChange={(e) => setDepositMemo(e.target.value)}
                        placeholder="e.g. invoice-42 — for your own records"
                        autoComplete="off"
                        spellCheck={false}
                        maxLength={28}
                      />
                      <span className="ep-money-hint ep-money-hint--inline">
                        This wallet is dedicated to your business, so nothing sent here needs a memo
                        to arrive — add one only if it helps you identify this deposit later. It's
                        included in the QR code for wallets that support it.
                      </span>
                      {depositMemo.trim() ? (
                        <div className="ep-money-copy-row">
                          <span className="ep-money-copy-row__value">{depositMemo.trim()}</span>
                          <button
                            type="button"
                            className="ep-money-copy-btn"
                            onClick={copyDepositMemo}
                            aria-label={depositMemoCopied ? "Memo copied" : "Copy memo"}
                          >
                            {depositMemoCopied ? "Copied" : "Copy"}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  <DepositAddressQr
                    address={p.depositAddress}
                    currency={p.depositAssetCode}
                    network={p.depositNetwork}
                    networkLabel={p.depositNetworkLabel}
                    memo={depositMemo}
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
                  {shouldOfferStellarWalletDeposit({
                    network: p.depositNetwork,
                    currency: p.depositAssetCode,
                    destination: p.depositAddress,
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
                  {p.depositCreateAccount ? (
                    <button
                      type="button"
                      className="ep-btn-primary"
                      style={{ marginTop: 12 }}
                      onClick={p.depositCreateAccount}
                    >
                      {p.depositCreateAccountLabel || "Create stablecoin account"}
                    </button>
                  ) : null}
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
                    {p.depositCurrency
                      ? `${formatPayAmount(p.depositAmount)} ${p.depositCurrency}`
                      : p.depositAmount}
                  </span>
                </div>
                {p.depositRateLine ? (
                  <div className="ep-money-review__row">
                    <span className="ep-money-review__k">Rate</span>
                    <span className="ep-money-review__v ep-money-review__v--mono">
                      {p.depositRateLine}
                    </span>
                  </div>
                ) : null}
                {p.depositQuoteRateText ? (
                  <div className="ep-money-review__row ep-money-review__row--emphasis">
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
                  <span className="ep-money-review__k">Rate locked</span>
                  <span className="ep-money-review__v">
                    {quoteCountdown ? (
                      <span
                        className={`ep-rate-lock${quoteExpired ? " ep-rate-lock--expired" : ""}`}
                        aria-live="off"
                      >
                        {quoteExpired ? "Expired — go back for a fresh quote" : `for ${quoteCountdown}`}
                      </span>
                    ) : (
                      p.depositArrivalText
                    )}
                  </span>
                </div>
                {p.depositIsBankRail ? (
                  <div className="ep-money-review__row">
                    <span className="ep-money-review__k">Arrival</span>
                    <span className="ep-money-review__v">{p.depositBankArrival}</span>
                  </div>
                ) : null}
              </div>
              {p.depositIsBankRail ? (
                <p className="ep-money-hint">
                  Next you&apos;ll get the account details and a reference to pay from your bank.
                </p>
              ) : null}

              {p.depositAcceptError ? (
                <div className="ep-money-banner ep-money-banner--danger" role="alert">
                  {p.depositAcceptError}
                </div>
              ) : null}

              <div className="ep-money-actions ep-money-flow__cta">
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
                  disabled={p.depositAccepting || quoteExpired}
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

          {showBankPay ? (
            <BankTransferInstructions
              amount={formatPayAmount(p.depositAmount)}
              currency={p.depositCurrency || ""}
              rows={(p.depositBankLines || []).map((ln: { k: string; v: string }) => ({ k: String(ln.k), v: String(ln.v) }))}
              arrival={p.depositBankArrival}
              onSent={p.closeModal}
            />
          ) : null}

          {showBankPay ? null : (
          <button
            type="button"
            className="ep-btn-secondary"
            onClick={p.closeModal}
            style={{ width: "auto", minWidth: 120 }}
          >
            Done
          </button>
          )}
        </div>
      ) : null}
    </>
  );
}
