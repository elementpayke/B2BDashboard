"use client";

import React, { useEffect, useMemo, useState } from "react";
import { payoutsApi, type PayoutMethod, type PayoutPreview } from "@/lib/services/payouts";
import {
  bankCodeFromOption,
  bankOptionLabel,
  buildPayoutPreviewBody,
  kesPayoutMinAmountHint,
  normalizePayoutBanks,
  normalizePayoutMethods,
  payoutApiErrorMessage,
  payoutCountryForMethod,
  payoutMethodKey,
  payoutMethodLabel,
  payoutTotalDebit,
  type PayoutBankOption,
  usesBankCodePayoutForm,
} from "@/lib/payoutForm";
import { formatCountdown } from "@/lib/services/transferTerms";
import type { FinancialAccount } from "@/lib/services/entities";
import { ApiRequestError } from "@/lib/apiClient";

export type PayoutModalProps = {
  entityId: string;
  account: FinancialAccount;
  onDone: () => void;
  onCancel: () => void;
};

function money(value: unknown, currency: string): string {
  const n = Number(String(value ?? "").replace(/,/g, ""));
  if (value === null || value === undefined || value === "" || !Number.isFinite(n)) return "";
  return `${new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)} ${currency}`;
}

/** Honest fee copy: the preview's number, or when it will be known — never a guess. */
export function payoutFeeText(preview: PayoutPreview, currency: string): string {
  const fee = money(preview.fee, String(preview.currency || currency));
  if (fee) return Number(preview.fee) === 0 ? "No fee" : fee;
  if (preview.fee_status === "pending_confirm") return "Set by the bank scheme · shown once confirmed";
  return "Not quoted for this method";
}

const EMPTY_BEN = {
  firstName: "",
  lastName: "",
  email: "",
  line1: "",
  city: "",
  postalCode: "",
  country: "",
};

export default function PayoutModal({ entityId, account, onDone, onCancel }: PayoutModalProps) {
  const [methods, setMethods] = useState<PayoutMethod[]>([]);
  const [methodId, setMethodId] = useState("");
  const [amount, setAmount] = useState("");
  const [destination, setDestination] = useState("");
  const [banks, setBanks] = useState<PayoutBankOption[]>([]);
  const [banksLoading, setBanksLoading] = useState(false);
  const [banksError, setBanksError] = useState("");
  const [selectedBankIndex, setSelectedBankIndex] = useState(-1);
  const [accountNumber, setAccountNumber] = useState("");
  const [accountHolderName, setAccountHolderName] = useState("");
  const [beneficiary, setBeneficiary] = useState(EMPTY_BEN);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<PayoutPreview | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const ccy = account.currency?.toUpperCase() || "";
  const kesMinHint = kesPayoutMinAmountHint(ccy);

  const selectedMethod = useMemo(() => {
    return methods.find((m, idx) => payoutMethodKey(m, idx) === methodId) ?? null;
  }, [methods, methodId]);

  const bankForm = selectedMethod ? usesBankCodePayoutForm(selectedMethod) : false;

  const selectedBank = useMemo(() => {
    if (selectedBankIndex < 0 || selectedBankIndex >= banks.length) return null;
    return banks[selectedBankIndex] ?? null;
  }, [banks, selectedBankIndex]);

  useEffect(() => {
    if (!preview?.expires_at) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [preview]);

  const [notice] = useState(
    "External bank emails or statements may show partner-scheme branding (not Element).",
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const raw = await payoutsApi.methods(entityId, account.id);
        if (cancelled) return;
        const list = normalizePayoutMethods(raw);
        setMethods(list);
        const defaultIdx = list.findIndex((m) => m.default === true);
        const pick = list[defaultIdx >= 0 ? defaultIdx : 0];
        if (pick) setMethodId(payoutMethodKey(pick, defaultIdx >= 0 ? defaultIdx : 0));
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof ApiRequestError
              ? err.message
              : "Payout methods unavailable for this account.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [entityId, account.id]);

  useEffect(() => {
    if (!selectedMethod || !bankForm) {
      setBanks([]);
      setSelectedBankIndex(-1);
      setBanksError("");
      return;
    }
    const country = payoutCountryForMethod(ccy, selectedMethod);
    setBeneficiary((prev) => ({
      ...prev,
      country: prev.country || country,
    }));
    let cancelled = false;
    (async () => {
      setBanksLoading(true);
      setBanksError("");
      try {
        const raw = await payoutsApi.banks(entityId, account.id, country || undefined);
        if (cancelled) return;
        const list = normalizePayoutBanks(raw);
        setBanks(list);
        setSelectedBankIndex(list.length > 0 ? 0 : -1);
      } catch (err) {
        if (!cancelled) {
          setBanks([]);
          setSelectedBankIndex(-1);
          setBanksError(payoutApiErrorMessage(err, account.currency));
        }
      } finally {
        if (!cancelled) setBanksLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [entityId, account.id, ccy, selectedMethod, bankForm]);

  const previewBody = (): Record<string, unknown> => {
    if (!selectedMethod) throw new Error("Choose a payout method.");
    return buildPayoutPreviewBody({
      amount,
      currency: account.currency,
      method: selectedMethod,
      simpleDestination: destination,
      beneficiary: bankForm
        ? {
            ...beneficiary,
            country: beneficiary.country || payoutCountryForMethod(ccy, selectedMethod),
          }
        : undefined,
      bank: bankForm
        ? {
            bankCode: selectedBank ? bankCodeFromOption(selectedBank) : "",
            accountNumber,
            accountHolderName,
          }
        : undefined,
      bankName: selectedBank ? String(selectedBank.bank_name || "") : "",
    });
  };

  const validateStep1 = (): string | null => {
    if (!methodId || !amount.trim()) return "Method and amount are required.";
    if (bankForm) {
      if (banksLoading) return "Still loading banks…";
      if (banksError) return banksError;
      if (!selectedBank) return "Choose a bank.";
      if (!accountNumber.trim()) return "Account number is required.";
      if (!accountHolderName.trim()) return "Account holder name is required.";
      if (!beneficiary.firstName.trim() || !beneficiary.lastName.trim()) {
        return "Recipient first and last name are required.";
      }
      if (!beneficiary.email.trim()) return "Recipient email is required.";
      if (!beneficiary.line1.trim() || !beneficiary.city.trim()) {
        return "Recipient address (street and city) is required.";
      }
      if (!beneficiary.postalCode.trim()) return "Postal code is required.";
      return null;
    }
    if (!destination.trim()) return "Destination (email or account) is required.";
    return null;
  };

  /** Step 1 → 2: ask for the exact terms before anything moves. */
  const review = async () => {
    setError("");
    const validation = validateStep1();
    if (validation) {
      setError(validation);
      return;
    }
    setBusy(true);
    try {
      setPreview(await payoutsApi.preview(entityId, account.id, previewBody()));
      setNow(Date.now());
    } catch (err) {
      setError(payoutApiErrorMessage(err, account.currency));
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    if (!preview) return;
    setError("");
    setBusy(true);
    try {
      await payoutsApi.confirm(entityId, account.id, {
        preview_token: preview.preview_token,
      });
      onDone();
    } catch (err) {
      setError(payoutApiErrorMessage(err, account.currency));
    } finally {
      setBusy(false);
    }
  };

  const reviewCcy = String(preview?.currency || account.currency);
  const countdown = formatCountdown(preview?.expires_at as string | undefined, now);
  const expired = countdown === "0:00";
  const methodLabel = selectedMethod ? payoutMethodLabel(selectedMethod) : methodId;

  const destinationSummary = bankForm
    ? `${selectedBank?.bank_name || bankCodeFromOption(selectedBank || {})} · ${accountNumber}`
    : String(preview?.destination || destination);

  if (preview) {
    const previewRecord = preview as Record<string, unknown>;
    const totalDebit = payoutTotalDebit(previewRecord);
    const totalDebitText = money(totalDebit, reviewCcy);
    const amountText = money(preview.amount ?? amount, reviewCcy) || `${amount} ${reviewCcy}`;
    const receives = money(preview.receive_amount, reviewCcy);
    const confirmLabel = totalDebitText
      ? `Send ${totalDebitText}`
      : `Send ${amountText}`;

    return (
      <div className="ep-payout ep-money-stack ep-money-stack--tight">
        <span className="ep-money-step-label">Step 2 · Review & confirm</span>
        <div className="ep-money-review" role="group" aria-label="Payout summary">
          <div className="ep-money-review__row">
            <span className="ep-money-review__k">From</span>
            <span className="ep-money-review__v">{account.currency} account</span>
          </div>
          <div className="ep-money-review__row">
            <span className="ep-money-review__k">To</span>
            <span className="ep-money-review__v">{destinationSummary}</span>
          </div>
          <div className="ep-money-review__row">
            <span className="ep-money-review__k">Via</span>
            <span className="ep-money-review__v">{String(preview.scheme || methodLabel)}</span>
          </div>
          {receives ? (
            <div className="ep-money-review__row ep-money-review__row--emphasis">
              <span className="ep-money-review__k">Recipient gets</span>
              <span className="ep-money-review__v ep-money-review__v--mono">{receives}</span>
            </div>
          ) : (
            <div className="ep-money-review__row ep-money-review__row--emphasis">
              <span className="ep-money-review__k">Payout amount</span>
              <span className="ep-money-review__v ep-money-review__v--mono">{amountText}</span>
            </div>
          )}
          <div className="ep-money-review__row">
            <span className="ep-money-review__k">Fee</span>
            <span className="ep-money-review__v ep-money-review__v--mono">{payoutFeeText(preview, reviewCcy)}</span>
          </div>
          {totalDebitText ? (
            <div className="ep-money-review__row ep-money-review__row--emphasis">
              <span className="ep-money-review__k">Total debited</span>
              <span className="ep-money-review__v ep-money-review__v--mono">{totalDebitText}</span>
            </div>
          ) : null}
          {countdown ? (
            <div className="ep-money-review__row">
              <span className="ep-money-review__k">Terms held</span>
              <span className="ep-money-review__v">
                <span className={`ep-rate-lock${expired ? " ep-rate-lock--expired" : ""}`}>
                  {expired ? "Expired — go back to refresh" : `for ${countdown}`}
                </span>
              </span>
            </div>
          ) : null}
        </div>
        <p className="ep-money-hint" role="note">
          Same currency, no conversion. {notice}
        </p>
        {error ? (
          <div className="ep-money-banner ep-money-banner--danger" role="alert">
            {error}
          </div>
        ) : null}
        <div className="ep-money-actions">
          <button type="button" className="ep-btn-secondary" onClick={() => setPreview(null)} disabled={busy}>
            Back
          </button>
          <button
            type="button"
            className="ep-btn-primary"
            onClick={confirm}
            disabled={busy || expired}
            aria-busy={busy || undefined}
          >
            {busy ? "Sending…" : confirmLabel}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="ep-payout ep-money-stack">
      <span className="ep-money-step-label">
        Step 1 · Pay out from {account.currency}
      </span>
      {loading ? <p className="ep-money-hint">Loading payout methods…</p> : null}
      <div className="ep-money-field">
        <label className="ep-money-label" htmlFor="payout-method">
          Method
        </label>
        <select
          id="payout-method"
          className="ep-money-input"
          value={methodId}
          onChange={(e) => setMethodId(e.target.value)}
          disabled={busy || loading || methods.length === 0}
        >
          {methods.length === 0 ? (
            <option value="">No methods available</option>
          ) : (
            methods.map((m, idx) => {
              const id = payoutMethodKey(m, idx);
              return (
                <option key={id} value={id}>
                  {payoutMethodLabel(m)}
                </option>
              );
            })
          )}
        </select>
      </div>

      {bankForm ? (
        <>
          <div className="ep-money-field">
            <label className="ep-money-label" htmlFor="payout-bank">
              Bank
            </label>
            <select
              id="payout-bank"
              className="ep-money-input"
              value={selectedBankIndex >= 0 ? String(selectedBankIndex) : ""}
              onChange={(e) => setSelectedBankIndex(Number(e.target.value))}
              disabled={busy || banksLoading || banks.length === 0}
            >
              {banksLoading ? (
                <option value="">Loading banks…</option>
              ) : banks.length === 0 ? (
                <option value="">No banks available</option>
              ) : (
                banks.map((b, idx) => (
                  <option key={`bank-${idx}`} value={String(idx)}>
                    {bankOptionLabel(b, idx)}
                  </option>
                ))
              )}
            </select>
            {banksError ? (
              <span className="ep-money-hint ep-money-hint--danger" role="alert">
                {banksError}
              </span>
            ) : null}
          </div>
          <div className="ep-money-field">
            <label className="ep-money-label" htmlFor="payout-account-number">
              Account number
            </label>
            <input
              id="payout-account-number"
              className="ep-money-input"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              disabled={busy}
              autoComplete="off"
            />
          </div>
          <div className="ep-money-field">
            <label className="ep-money-label" htmlFor="payout-account-holder">
              Account holder name
            </label>
            <input
              id="payout-account-holder"
              className="ep-money-input"
              value={accountHolderName}
              onChange={(e) => setAccountHolderName(e.target.value)}
              disabled={busy}
              autoComplete="name"
            />
          </div>
          <fieldset className="ep-money-field" disabled={busy}>
            <legend className="ep-money-label">Recipient (beneficiary)</legend>
            <div className="ep-money-stack ep-money-stack--tight">
              <input
                className="ep-money-input"
                placeholder="First name"
                aria-label="Recipient first name"
                value={beneficiary.firstName}
                onChange={(e) => setBeneficiary((p) => ({ ...p, firstName: e.target.value }))}
                autoComplete="given-name"
              />
              <input
                className="ep-money-input"
                placeholder="Last name"
                aria-label="Recipient last name"
                value={beneficiary.lastName}
                onChange={(e) => setBeneficiary((p) => ({ ...p, lastName: e.target.value }))}
                autoComplete="family-name"
              />
              <input
                className="ep-money-input"
                placeholder="Email"
                aria-label="Recipient email"
                type="email"
                value={beneficiary.email}
                onChange={(e) => setBeneficiary((p) => ({ ...p, email: e.target.value }))}
                autoComplete="email"
              />
              <input
                className="ep-money-input"
                placeholder="Street address"
                aria-label="Recipient street address"
                value={beneficiary.line1}
                onChange={(e) => setBeneficiary((p) => ({ ...p, line1: e.target.value }))}
                autoComplete="street-address"
              />
              <input
                className="ep-money-input"
                placeholder="City"
                aria-label="Recipient city"
                value={beneficiary.city}
                onChange={(e) => setBeneficiary((p) => ({ ...p, city: e.target.value }))}
                autoComplete="address-level2"
              />
              <input
                className="ep-money-input"
                placeholder="Postal code"
                aria-label="Recipient postal code"
                value={beneficiary.postalCode}
                onChange={(e) => setBeneficiary((p) => ({ ...p, postalCode: e.target.value }))}
                autoComplete="postal-code"
              />
            </div>
          </fieldset>
        </>
      ) : (
        <div className="ep-money-field">
          <label className="ep-money-label" htmlFor="payout-destination">
            Destination (email / account)
          </label>
          <input
            id="payout-destination"
            className="ep-money-input"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            disabled={busy}
            autoComplete="off"
          />
        </div>
      )}

      <div className="ep-money-field">
        <label className="ep-money-label" htmlFor="payout-amount">
          Amount ({account.currency})
        </label>
        <input
          id="payout-amount"
          className="ep-money-input ep-money-input--amount"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          disabled={busy}
          placeholder="0.00"
          aria-describedby="payout-terms"
        />
        <span id="payout-terms" className="ep-terms-line">
          <span>
            {kesMinHint ? `${kesMinHint} ` : ""}
            Fee and total debit are shown on review — nothing is sent until you confirm.
          </span>
        </span>
      </div>
      <p className="ep-money-hint" role="note">
        {notice}
      </p>
      {error ? (
        <div className="ep-money-banner ep-money-banner--danger" role="alert">
          {error}
        </div>
      ) : null}
      <div className="ep-money-actions">
        <button type="button" className="ep-btn-secondary" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button
          type="button"
          className="ep-btn-primary"
          onClick={review}
          disabled={busy || loading || !methodId}
          aria-busy={busy || undefined}
        >
          {busy ? "Getting terms…" : "Review payout"}
        </button>
      </div>
    </div>
  );
}
