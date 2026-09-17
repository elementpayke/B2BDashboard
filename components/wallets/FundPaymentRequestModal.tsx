"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  isTerminalPaymentRequestStatus,
  paymentRequestsApi,
  remittanceMethodLabel,
  type PaymentRequest,
  type PaymentRequestMethod,
} from "@/lib/services/paymentRequests";

export type FundPaymentRequestModalProps = {
  entityId: string;
  accountId: string;
  currency: string;
  accountName: string;
  method: PaymentRequestMethod;
  onBack: () => void;
  onDone?: () => void;
};

function newClientRef(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `pr-${crypto.randomUUID()}`;
  }
  return `pr-${Date.now()}`;
}

function redirectUrl(): string {
  if (typeof window === "undefined") return "https://app.elementpay.net/wallets";
  return `${window.location.origin}/wallets?fund=return`;
}

function statusLabel(status: string | null | undefined): string {
  const raw = (status || "").trim().toLowerCase();
  if (!raw) return "Unknown";
  return raw.replace(/_/g, " ");
}

/**
 * Create and track an Interac / open-banking payment request via Mboka.
 * Never surfaces raw PSP hosted checkout URLs.
 */
export default function FundPaymentRequestModal({
  entityId,
  accountId,
  currency,
  accountName,
  method,
  onBack,
  onDone,
}: FundPaymentRequestModalProps) {
  const [amount, setAmount] = useState("");
  const [payerName, setPayerName] = useState("");
  const [payerEmail, setPayerEmail] = useState("");
  const [narration, setNarration] = useState(`Fund ${currency}`);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [request, setRequest] = useState<PaymentRequest | null>(null);

  const methodLabel = remittanceMethodLabel(method);
  const needsPayer = method === "interac";
  const canConfirm =
    method === "interac" && !!request && !isTerminalPaymentRequestStatus(request.status);

  const refresh = useCallback(async () => {
    if (!request?.id) return;
    try {
      const latest = await paymentRequestsApi.get(entityId, accountId, request.id);
      setRequest(latest);
      if (isTerminalPaymentRequestStatus(latest.status) && onDone) onDone();
    } catch {
      /* keep last known status; next poll retries */
    }
  }, [accountId, entityId, onDone, request?.id]);

  useEffect(() => {
    if (!request?.id || isTerminalPaymentRequestStatus(request.status)) return;
    const id = window.setInterval(() => {
      void refresh();
    }, 4000);
    return () => window.clearInterval(id);
  }, [refresh, request?.id, request?.status]);

  const canSubmit = useMemo(() => {
    if (!amount.trim() || Number(amount) <= 0) return false;
    if (needsPayer && (!payerName.trim() || !payerEmail.trim().includes("@"))) return false;
    return !busy;
  }, [amount, busy, needsPayer, payerEmail, payerName]);

  async function onCreate() {
    setError("");
    setBusy(true);
    try {
      const created = await paymentRequestsApi.create(entityId, accountId, {
        method,
        amount: amount.trim(),
        client_ref: newClientRef(),
        redirect_url: redirectUrl(),
        narration: narration.trim() || `Fund ${currency}`,
        ...(needsPayer
          ? { payer: { name: payerName.trim(), email: payerEmail.trim() } }
          : {}),
      });
      setRequest(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create payment request.");
    } finally {
      setBusy(false);
    }
  }

  async function onConfirm() {
    if (!request?.id) return;
    setError("");
    setBusy(true);
    try {
      const updated = await paymentRequestsApi.confirm(entityId, accountId, request.id);
      setRequest(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not confirm payment request.");
    } finally {
      setBusy(false);
    }
  }

  if (request) {
    return (
      <div className="ep-fund-pr">
        <p className="ep-fund-pr__intro">
          {methodLabel} request for <strong>{accountName}</strong> ({currency})
        </p>

        <div className="ep-fund-pr__panel" role="status">
          <div className="ep-fund-pr__row">
            <span className="ep-fund-pr__k">Status</span>
            <span className="ep-fund-pr__v ep-fund-pr__v--status">{statusLabel(request.status)}</span>
          </div>
          {request.amount ? (
            <div className="ep-fund-pr__row">
              <span className="ep-fund-pr__k">Amount</span>
              <span className="ep-fund-pr__v">
                {request.amount} {request.currency || currency}
              </span>
            </div>
          ) : null}
          {request.reference_number ? (
            <div className="ep-fund-pr__row">
              <span className="ep-fund-pr__k">Reference</span>
              <code className="ep-fund-pr__v ep-mono">{request.reference_number}</code>
            </div>
          ) : null}
        </div>

        {request.security_question ? (
          <p className="ep-fund-pr__note">{request.security_question}</p>
        ) : null}

        <p className="ep-fund-pr__notice" role="note">
          {request.requires_hosted_checkout
            ? "This method needs a secure ElementPay-hosted step. Complete it from the email or in-app prompt — we never open third-party checkout pages here."
            : method === "interac"
              ? "Complete the Interac Request for Money in your bank app. Messages from the rail may not show ElementPay branding."
              : "Approve the open-banking payment in your bank app when prompted."}
        </p>

        {request.failure?.code ? (
          <p className="ep-fund-pr__error" role="alert">
            Failed ({request.failure.code})
          </p>
        ) : null}
        {error ? (
          <p className="ep-fund-pr__error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="ep-money-actions ep-fund-pr__actions">
          <button type="button" className="ep-btn-secondary" onClick={onBack} disabled={busy}>
            Back
          </button>
          {canConfirm ? (
            <button
              type="button"
              className="ep-btn-primary"
              onClick={() => void onConfirm()}
              disabled={busy}
              aria-busy={busy || undefined}
            >
              {busy ? "Confirming…" : "I've paid — confirm"}
            </button>
          ) : null}
          <button
            type="button"
            className="ep-btn-secondary"
            onClick={() => void refresh()}
            disabled={busy}
          >
            Refresh status
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="ep-fund-pr">
      <p className="ep-fund-pr__intro">
        Fund <strong>{accountName}</strong> with {methodLabel} ({currency})
      </p>
      <p className="ep-fund-pr__notice" role="note">
        External bank messages for this {methodLabel} request may show the rail&apos;s branding, not
        ElementPay. We never open third-party checkout pages from this screen.
      </p>

      <label className="ep-field">
        <span>Amount</span>
        <input
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
        />
      </label>
      <label className="ep-field">
        <span>Narration</span>
        <input value={narration} onChange={(e) => setNarration(e.target.value)} maxLength={255} />
      </label>
      {needsPayer ? (
        <>
          <label className="ep-field">
            <span>Payer name</span>
            <input value={payerName} onChange={(e) => setPayerName(e.target.value)} maxLength={128} />
          </label>
          <label className="ep-field">
            <span>Payer email</span>
            <input
              type="email"
              value={payerEmail}
              onChange={(e) => setPayerEmail(e.target.value)}
              maxLength={254}
            />
          </label>
        </>
      ) : null}

      {error ? (
        <p className="ep-fund-pr__error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="ep-money-actions ep-fund-pr__actions">
        <button type="button" className="ep-btn-secondary" onClick={onBack} disabled={busy}>
          Back
        </button>
        <button
          type="button"
          className="ep-btn-primary"
          onClick={() => void onCreate()}
          disabled={!canSubmit}
          aria-busy={busy || undefined}
        >
          {busy ? "Creating…" : `Create ${methodLabel} request`}
        </button>
      </div>
    </div>
  );
}
