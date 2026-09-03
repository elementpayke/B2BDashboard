"use client";
import React from "react";
import {
  CURRENCY_OPTIONS,
  STABLECOIN_OPTIONS,
  NETWORK_OPTIONS,
  SUPPORTED_IBAN_CURRENCIES,
  isCurrencySupported,
  isStablecoinSupported,
  isStablecoinNetworkSupported,
  networksForStablecoin,
} from "@/lib/services/depositAccounts";

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
  closeModal: () => void;
  submitCreateAccount: () => void;
};

function slotKey(currency: string, network: string): string {
  return `${currency.trim().toUpperCase()}:${network.trim().toUpperCase()}`;
}

export default function CreateAccountModal(p: CreateAccountModalProps) {
  const isStablecoin = p.createAccountKind === "stablecoin";
  const occupiedSlots = new Set(
    (p.occupiedSlots ?? []).map((s) => s.trim().toUpperCase()),
  );
  const occupiedCurrencies = new Set(
    (p.occupiedCurrencies ?? []).map((c) => c.trim().toUpperCase()),
  );

  const selectedCurrency = (p.createAccountStablecoin || "USDC").trim().toUpperCase();
  const networksForAsset = networksForStablecoin(selectedCurrency);
  const availableNetworks = networksForAsset.filter(
    (code) => !occupiedSlots.has(slotKey(selectedCurrency, code)),
  );
  const availableCurrencies = SUPPORTED_IBAN_CURRENCIES.filter(
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

  const canSubmit = !p.createAccountSaving && !slotsFull && !selectedSlotTaken;

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
            : "You already have fiat accounts for every supported currency (USD and EUR)."}
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
                      ? p.createAccountStablecoin === "USDT" && o.code === "STELLAR"
                        ? " — USDT not on Stellar"
                        : " — not available yet"
                      : taken
                        ? " — already open"
                        : ""}
                  </option>
                );
              })}
            </select>
            <div className="ep-wallets-create__hint">
              One account per asset and network. USDC on Base, Polygon, and Stellar; USDT on
              Base and Polygon only.
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
            {CURRENCY_OPTIONS.map((c) => {
              const supported = isCurrencySupported(c.code);
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
            Bank accounts are issued one per currency (USD and EUR only).
          </div>
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
