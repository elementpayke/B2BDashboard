"use client";
import React from "react";
import {
  CURRENCY_OPTIONS,
  STABLECOIN_OPTIONS,
  NETWORK_OPTIONS,
  isCurrencySupported,
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
  closeModal: () => void;
  submitCreateAccount: () => void;
};

export default function CreateAccountModal(p: CreateAccountModalProps) {
  const isStablecoin = p.createAccountKind === "stablecoin";

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
              className={
                p.createAccountStablecoin
                  ? "ep-wallets-create__control"
                  : "ep-wallets-create__control ep-wallets-create__control--placeholder"
              }
            >
              <option value="">Select stablecoin</option>
              {STABLECOIN_OPTIONS.map((o: any) => (
                <option key={o.code} value={o.code}>
                  {o.label}
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
              className={
                p.createAccountNetwork
                  ? "ep-wallets-create__control"
                  : "ep-wallets-create__control ep-wallets-create__control--placeholder"
              }
            >
              <option value="">Select network</option>
              {NETWORK_OPTIONS.map((o: any) => (
                <option key={o.code} value={o.code}>
                  {o.label}
                </option>
              ))}
            </select>
            <div className="ep-wallets-create__hint">
              Network and asset must match the payer’s rail exactly.
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
            className={
              p.createAccountCurrency
                ? "ep-wallets-create__control"
                : "ep-wallets-create__control ep-wallets-create__control--placeholder"
            }
          >
            <option value="">Select currency</option>
            {CURRENCY_OPTIONS.map((c: any) => (
              <option key={c.code} value={c.code} disabled={!isCurrencySupported(c.code)}>
                {c.label} ({c.code})
                {isCurrencySupported(c.code) ? "" : " — not available yet"}
              </option>
            ))}
          </select>
          <div className="ep-wallets-create__hint">
            Bank accounts are currently issued in USD and EUR only.
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
          Cancel
        </button>
        <button
          type="button"
          onClick={p.submitCreateAccount}
          disabled={p.createAccountSaving}
          className="ep-wallets-create__btn ep-wallets-create__btn--primary"
        >
          {p.createAccountSaving ? "Creating…" : "Create account"}
        </button>
      </div>
    </div>
  );
}
