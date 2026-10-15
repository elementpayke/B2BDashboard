"use client";

import React, { useEffect, useState } from "react";
import { payoutsApi, type PayoutMethod, type PayoutPreview } from "@/lib/services/payouts";
import { formatCountdown } from "@/lib/services/transferTerms";
import type { FinancialAccount } from "@/lib/services/entities";
import { ApiRequestError } from "@/lib/apiClient";

export type PayoutModalProps = {
  entityId: string;
  account: FinancialAccount;
  onDone: () => void;
  onCancel: () => void;
};

function normalizeMethods(raw: unknown): PayoutMethod[] {
  if (Array.isArray(raw)) return raw as PayoutMethod[];
  if (raw && typeof raw === "object" && Array.isArray((raw as { methods?: unknown }).methods)) {
    return (raw as { methods: PayoutMethod[] }).methods;
  }
  return [];
}

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

export default function PayoutModal({ entityId, account, onDone, onCancel }: PayoutModalProps) {
  const [methods, setMethods] = useState<PayoutMethod[]>([]);
  const [methodId, setMethodId] = useState("");
  const [amount, setAmount] = useState("");
  const [destination, setDestination] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<PayoutPreview | null>(null);
  const [now, setNow] = useState(() => Date.now());
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
        const list = normalizeMethods(raw);
        setMethods(list);
        const first = list[0];
        setMethodId(String(first?.id || first?.method || ""));
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

  const body = () => ({
    method: methodId,
    amount: amount.trim(),
    currency: account.currency,
    destination: { account: destination.trim() },
  });

  /** Step 1 → 2: ask for the exact terms before anything moves. */
  const review = async () => {
    setError("");
    if (!methodId || !amount.trim() || !destination.trim()) {
      setError("Method, amount, and destination are required.");
      return;
    }
    setBusy(true);
    try {
      setPreview(await payoutsApi.preview(entityId, account.id, body()));
      setNow(Date.now());
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Couldn't price this payout. Try again.");
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
        ...preview,
        ...body(),
        preview_token: preview.preview_token,
      });
      onDone();
    } catch (err) {
      setError(
        err instanceof ApiRequestError ? err.message : "Payout failed. Try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  const ccy = String(preview?.currency || account.currency);
  const countdown = formatCountdown(preview?.expires_at as string | undefined, now);
  const expired = countdown === "0:00";
  const methodLabel = (() => {
    const m = methods.find((x, idx) => String(x.id || x.method || idx) === methodId);
    return String(m?.label || m?.method || m?.id || methodId);
  })();

  if (preview) {
    const amountText = money(preview.amount ?? amount, ccy) || `${amount} ${ccy}`;
    const receives = money(preview.receive_amount, ccy);
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
            <span className="ep-money-review__v">{String(preview.destination || destination)}</span>
          </div>
          <div className="ep-money-review__row">
            <span className="ep-money-review__k">Via</span>
            <span className="ep-money-review__v">{String(preview.scheme || methodLabel)}</span>
          </div>
          <div className="ep-money-review__row ep-money-review__row--emphasis">
            <span className="ep-money-review__k">You send</span>
            <span className="ep-money-review__v ep-money-review__v--mono">{amountText}</span>
          </div>
          <div className="ep-money-review__row">
            <span className="ep-money-review__k">Fee</span>
            <span className="ep-money-review__v ep-money-review__v--mono">{payoutFeeText(preview, ccy)}</span>
          </div>
          {receives ? (
            <div className="ep-money-review__row ep-money-review__row--emphasis">
              <span className="ep-money-review__k">Recipient gets</span>
              <span className="ep-money-review__v ep-money-review__v--mono">{receives}</span>
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
            {busy ? "Sending…" : `Send ${amountText}`}
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
              const id = String(m.id || m.method || idx);
              const label = String(m.label || m.method || m.id || "Method");
              return (
                <option key={id} value={id}>
                  {label}
                </option>
              );
            })
          )}
        </select>
      </div>
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
          <span>Fee and what arrives are shown on review — nothing is sent until you confirm.</span>
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
