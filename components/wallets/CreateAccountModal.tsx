"use client";
import React, { useEffect, useId, useState } from "react";
import {
  STABLECOIN_OPTIONS,
  NETWORK_OPTIONS,
  SUPPORTED_IBAN_CURRENCIES,
  currencyOptionsFor,
  isCurrencySupported,
  isStablecoinSupported,
  isStablecoinNetworkSupported,
  networksForStablecoin,
  type SupportedAccountDescriptor,
} from "@/lib/services/depositAccounts";
import { isAllowlistedStellarStable } from "@/lib/config/stellarFeatures";

export type CreateAccountModalProps = {
  createAccountName: string;
  setCreateAccountName: (e: React.ChangeEvent<HTMLInputElement>) => void;
  createAccountKind: string;
  createAccountCurrency: string;
  setCreateAccountCurrency: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  createAccountStablecoin: string;
  setCreateAccountStablecoin: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  createAccountNetwork: string;
  setCreateAccountNetwork: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  createAccountError: string;
  createAccountSaving: boolean;
  /**
   * Occupied (currency, network) slots as `USDC:BASE` / `USDT:POLYGON`.
   * Networks for the selected stablecoin are derived from this.
   */
  occupiedSlots?: readonly string[];
  /** ISO currencies already held (e.g. USD, EUR). */
  occupiedCurrencies?: readonly string[];
  /**
   * Live currency list from `supportedCurrenciesFromEligibility` — defaults
   * to the static USD/EUR constant when the backend hasn't shipped
   * `supported_accounts` yet, so this prop is optional.
   */
  supportedCurrencies?: readonly string[];
  /**
   * Full eligibility descriptors (same source as `supportedCurrencies`) —
   * used to look up a per-currency `monthly_maintenance_fee`. Absent on
   * today's backend, so the fee disclosure below simply never renders yet.
   */
  supportedAccounts?: readonly SupportedAccountDescriptor[];
  closeModal: () => void;
  submitCreateAccount: () => void;
};

function slotKey(currency: string, network: string): string {
  return `${currency.trim().toUpperCase()}:${network.trim().toUpperCase()}`;
}

export default function CreateAccountModal(p: CreateAccountModalProps) {
  const isStablecoin = p.createAccountKind === "stablecoin";
  const feeCheckboxId = useId();
  const [feeAcknowledged, setFeeAcknowledged] = useState(false);
  const monthlyFee = isStablecoin
    ? null
    : (p.supportedAccounts ?? []).find(
        (d) => d.currency.trim().toUpperCase() === p.createAccountCurrency.trim().toUpperCase(),
      )?.monthly_maintenance_fee ?? null;

  // A fee notice acknowledged for one currency shouldn't silently carry over
  // once the user picks a different one.
  useEffect(() => {
    setFeeAcknowledged(false);
  }, [p.createAccountCurrency]);

  const occupiedSlots = new Set(
    (p.occupiedSlots ?? []).map((s) => s.trim().toUpperCase()),
  );
  const occupiedCurrencies = new Set(
    (p.occupiedCurrencies ?? []).map((c) => c.trim().toUpperCase()),
  );
  const supportedCurrencies = p.supportedCurrencies ?? SUPPORTED_IBAN_CURRENCIES;
  const currencyOptions = currencyOptionsFor(supportedCurrencies);

  const selectedCurrency = (p.createAccountStablecoin || "USDC").trim().toUpperCase();
  const networksForAsset = networksForStablecoin(selectedCurrency);
  const availableNetworks = networksForAsset.filter(
    (code) => !occupiedSlots.has(slotKey(selectedCurrency, code)),
  );
  const availableCurrencies = supportedCurrencies.filter(
    (code) => !occupiedCurrencies.has(code),
  );

  const anyStablecoinSlotOpen = STABLECOIN_OPTIONS.some((o) => {
    if (!isStablecoinSupported(o.code)) return false;
    return networksForStablecoin(o.code).some(
      (net) => !occupiedSlots.has(slotKey(o.code, net)),
    );
  });

  const slotsFull = isStablecoin
    ? !anyStablecoinSlotOpen
    : availableCurrencies.length === 0;

  const selectedSlotTaken = isStablecoin
    ? Boolean(p.createAccountNetwork) &&
      Boolean(p.createAccountStablecoin) &&
      occupiedSlots.has(slotKey(p.createAccountStablecoin, p.createAccountNetwork))
    : Boolean(p.createAccountCurrency) &&
      occupiedCurrencies.has(p.createAccountCurrency.trim().toUpperCase());

  const canSubmit =
    !p.createAccountSaving &&
    !slotsFull &&
    !selectedSlotTaken &&
    (!monthlyFee || feeAcknowledged);

  return (
    <div className="ep-wallets-create">
      <div className="ep-wallets-create__kind">
        <span className="ep-wallets-create__kind-badge">
          {isStablecoin ? "Stablecoin" : "Bank · Fiat"}
        </span>
        <p className="ep-wallets-create__kind-text">
          {isStablecoin
            ? "Create an on-chain deposit account. Choose the asset and network carefully — funds sent on the wrong network cannot be recovered."
            : "Issue a fiat currency account for inbound bank transfers. Deposit coordinates (IBAN / bank details) are provisioned after creation."}
        </p>
      </div>

      {slotsFull ? (
        <div className="ep-wallets-create__error" role="status">
          {isStablecoin
            ? "You already have a stablecoin account on every available asset and network."
            : `You already have fiat accounts for every supported currency (${supportedCurrencies.join(", ")}).`}
        </div>
      ) : null}

      <div className="ep-wallets-create__field">
        <label htmlFor="create-account-name" className="ep-wallets-create__label">
          Account name <span className="ep-wallets-create__req">*</span>
        </label>
        <input
          id="create-account-name"
          value={p.createAccountName}
          onChange={p.setCreateAccountName}
          placeholder="e.g. Payroll, Operations"
          autoComplete="off"
          className="ep-wallets-create__control"
          disabled={slotsFull || p.createAccountSaving}
        />
      </div>

      {isStablecoin ? (
        <>
          <div className="ep-wallets-create__field">
            <label htmlFor="create-account-stablecoin" className="ep-wallets-create__label">
              Stablecoin <span className="ep-wallets-create__req">*</span>
            </label>
            <select
              id="create-account-stablecoin"
              value={p.createAccountStablecoin}
              onChange={p.setCreateAccountStablecoin}
              disabled={slotsFull || p.createAccountSaving}
              className={
                p.createAccountStablecoin
                  ? "ep-wallets-create__control"
                  : "ep-wallets-create__control ep-wallets-create__control--placeholder"
              }
            >
              <option value="">Select stablecoin</option>
              {STABLECOIN_OPTIONS.map((o) => (
                <option
                  key={o.code}
                  value={o.code}
                  disabled={!isStablecoinSupported(o.code)}
                >
                  {o.label}
                  {isStablecoinSupported(o.code) ? "" : " — not available yet"}
                </option>
              ))}
            </select>
          </div>
          <div className="ep-wallets-create__field">
            <label htmlFor="create-account-network" className="ep-wallets-create__label">
              Network <span className="ep-wallets-create__req">*</span>
            </label>
            <select
              id="create-account-network"
              value={p.createAccountNetwork}
              onChange={p.setCreateAccountNetwork}
              disabled={slotsFull || p.createAccountSaving}
              className={
                p.createAccountNetwork
                  ? "ep-wallets-create__control"
                  : "ep-wallets-create__control ep-wallets-create__control--placeholder"
              }
            >
              <option value="">Select network</option>
              {NETWORK_OPTIONS.map((o) => {
                const supported =
                  isStablecoinNetworkSupported(o.code) &&
                  networksForAsset.includes(o.code);
                const taken =
                  Boolean(p.createAccountStablecoin) &&
                  occupiedSlots.has(slotKey(selectedCurrency, o.code));
                return (
                  <option
                    key={o.code}
                    value={o.code}
                    disabled={!supported || taken}
                  >
                    {o.label}
                    {!supported
                      ? p.createAccountStablecoin &&
                        isAllowlistedStellarStable(p.createAccountStablecoin) &&
                        o.code !== "STELLAR"
                        ? " — Stellar only"
                        : " — not available yet"
                      : taken
                        ? " — already open"
                        : ""}
                  </option>
                );
              })}
            </select>
            <div className="ep-wallets-create__hint">
              One account per asset and network. USDC is available on Base, Polygon, and
              Stellar. Allowlisted Stellar rails like USDT or EURC settle as USDC after
              funding.
            </div>
          </div>
        </>
      ) : (
        <div className="ep-wallets-create__field">
          <label htmlFor="create-account-currency" className="ep-wallets-create__label">
            Currency <span className="ep-wallets-create__req">*</span>
          </label>
          <select
            id="create-account-currency"
            value={p.createAccountCurrency}
            onChange={p.setCreateAccountCurrency}
            disabled={slotsFull || p.createAccountSaving}
            className={
              p.createAccountCurrency
                ? "ep-wallets-create__control"
                : "ep-wallets-create__control ep-wallets-create__control--placeholder"
            }
          >
            <option value="">Select currency</option>
            {currencyOptions.map((c) => {
              const supported = isCurrencySupported(c.code, supportedCurrencies);
              const taken = occupiedCurrencies.has(c.code.trim().toUpperCase());
              return (
                <option
                  key={c.code}
                  value={c.code}
                  disabled={!supported || taken}
                >
                  {c.label} ({c.code})
                  {!supported
                    ? " — not available yet"
                    : taken
                      ? " — already open"
                      : ""}
                </option>
              );
            })}
          </select>
          <div className="ep-wallets-create__hint">
            Bank accounts are issued one per currency ({supportedCurrencies.join(", ")} only).
          </div>
          {monthlyFee ? (
            <div className="ep-wallets-create__field" style={{ marginTop: 10 }}>
              <div className="ep-wallets-create__hint">
                This account has a {monthlyFee.amount} {monthlyFee.currency}/month maintenance
                fee.
              </div>
              <label
                htmlFor={feeCheckboxId}
                style={{ display: "flex", alignItems: "flex-start", gap: 8, marginTop: 6 }}
              >
                <input
                  id={feeCheckboxId}
                  type="checkbox"
                  checked={feeAcknowledged}
                  onChange={(e) => setFeeAcknowledged(e.target.checked)}
                  disabled={p.createAccountSaving}
                />
                <span className="ep-wallets-create__label" style={{ margin: 0 }}>
                  I understand this account has a {monthlyFee.amount} {monthlyFee.currency}
                  /month fee.
                </span>
              </label>
            </div>
          ) : null}
        </div>
      )}

      {p.createAccountError ? (
        <div className="ep-wallets-create__error" role="alert">
          {p.createAccountError}
        </div>
      ) : null}

      <div className="ep-wallets-create__actions">
        <button
          type="button"
          onClick={p.closeModal}
          className="ep-wallets-create__btn ep-wallets-create__btn--ghost"
          disabled={p.createAccountSaving}
        >
          {slotsFull ? "Close" : "Cancel"}
        </button>
        <button
          type="button"
          onClick={p.submitCreateAccount}
          disabled={!canSubmit}
          className="ep-wallets-create__btn ep-wallets-create__btn--primary"
        >
          {p.createAccountSaving ? "Creating…" : "Create account"}
        </button>
      </div>
    </div>
  );
}
