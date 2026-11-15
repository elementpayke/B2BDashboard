"use client";

import React, { useMemo, useState } from "react";
import FeeDisclosureRows, { feeDisclosureText } from "@/components/money/FeeDisclosure";
import {
  bookTransferTotalDebit,
  bookTransfersApi,
  type BookTransferPreview,
} from "@/lib/services/bookTransfers";
import { formatConvertAmount } from "@/lib/services/conversions";
import type { FinancialAccount } from "@/lib/services/entities";
import { ApiRequestError } from "@/lib/apiClient";

export type BookTransferModalProps = {
  entityId: string;
  source: FinancialAccount;
  candidates: FinancialAccount[];
  onDone: () => void;
  onCancel: () => void;
};

export default function BookTransferModal({
  entityId,
  source,
  candidates,
  onDone,
  onCancel,
}: BookTransferModalProps) {
  const sameCurrency = useMemo(
    () =>
      candidates.filter(
        (a) =>
          a.id !== source.id &&
          (a.currency || "").toUpperCase() === (source.currency || "").toUpperCase() &&
          (a.assetType || "").toLowerCase() === "fiat",
      ),
    [candidates, source],
  );
  const [destId, setDestId] = useState(sameCurrency[0]?.id || "");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  // Preview and confirm used to fire from the same click, so the fee the
  // aggregator returned was fetched and thrown away without the user ever
  // seeing a number. The preview now parks here as a review step instead.
  const [preview, setPreview] = useState<BookTransferPreview | null>(null);

  const currency = (source.currency || "").toUpperCase();
  const money = (value: unknown): string => {
    if (value == null || String(value).trim() === "") return "";
    return `${formatConvertAmount(String(value))}${currency ? ` ${currency}` : ""}`;
  };

  const requestPreview = async () => {
    setError("");
    if (!destId || !amount.trim()) {
      setError("Choose a destination and amount.");
      return;
    }
    setBusy(true);
    try {
      setPreview(
        await bookTransfersApi.preview(entityId, source.id, {
          destination_account_id: destId,
          amount: amount.trim(),
          currency: source.currency,
        }),
      );
    } catch (err) {
      setError(
        err instanceof ApiRequestError
          ? err.message
          : "Couldn't price this move. Try again or contact support.",
      );
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (!preview) return;
    setError("");
    setBusy(true);
    try {
      const confirmed = await bookTransfersApi.confirm(entityId, source.id, {
        ...preview,
        destination_account_id: destId,
        amount: amount.trim(),
        currency: source.currency,
        preview_token: preview.preview_token,
      });
      setStatus(String(confirmed.status || "submitted"));
      onDone();
    } catch (err) {
      setError(
        err instanceof ApiRequestError
          ? err.message
          : "Move failed. Try again or contact support.",
      );
    } finally {
      setBusy(false);
    }
  };

  if (preview) {
    const destination = sameCurrency.find((a) => a.id === destId);
    const feeText = feeDisclosureText({
      raw: preview.fee,
      formatted: money(preview.fee),
      whenUnknown: "Shown on your statement once settled",
    });
    const totalText = money(bookTransferTotalDebit(preview));

    return (
      <div className="ep-book-transfer">
        <span className="ep-money-step-label">Step 2 · Review &amp; confirm</span>
        <div className="ep-money-review" role="group" aria-label="Move summary">
          <div className="ep-money-review__row">
            <span className="ep-money-review__k">From</span>
            <span className="ep-money-review__v">{currency} account</span>
          </div>
          <div className="ep-money-review__row">
            <span className="ep-money-review__k">To</span>
            <span className="ep-money-review__v">
              {destination ? `${destination.currency} · ${destination.id}` : destId}
            </span>
          </div>
          <div className="ep-money-review__row ep-money-review__row--emphasis">
            <span className="ep-money-review__k">Amount</span>
            <span className="ep-money-review__v ep-money-review__v--mono">
              {money(preview.amount ?? amount.trim())}
            </span>
          </div>
          <FeeDisclosureRows
            fee={feeText}
            total={totalText}
            totalWhenUnknown="Shown on your statement once settled"
          />
        </div>
        <p className="ep-money-hint" role="note">
          Same currency, no FX. Both accounts are yours, so the money stays inside Element.
        </p>
        {error ? (
          <div className="ep-money-banner ep-money-banner--danger" role="alert">
            {error}
          </div>
        ) : null}
        {status ? <p className="ep-muted">Status: {status}</p> : null}
        <div className="ep-modal-actions">
          <button type="button" onClick={() => setPreview(null)} disabled={busy}>
            Back
          </button>
          <button type="button" onClick={submit} disabled={busy}>
            {busy ? "Moving…" : "Confirm move"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="ep-book-transfer">
      <p className="ep-fund-chooser__intro">
        Move {source.currency} between your Element accounts (same currency, no FX).
      </p>
      <label className="ep-field">
        <span>From</span>
        <input value={`${source.currency} · ${source.id}`} disabled readOnly />
      </label>
      <label className="ep-field">
        <span>To</span>
        <select value={destId} onChange={(e) => setDestId(e.target.value)} disabled={busy}>
          {sameCurrency.length === 0 ? (
            <option value="">No other {source.currency} account</option>
          ) : (
            sameCurrency.map((a) => (
              <option key={a.id} value={a.id}>
                {a.currency} · {a.id}
              </option>
            ))
          )}
        </select>
      </label>
      <label className="ep-field">
        <span>Amount</span>
        <input
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          disabled={busy}
          placeholder="0.00"
        />
      </label>
      {error ? <p className="ep-error" role="alert">{error}</p> : null}
      <div className="ep-modal-actions">
        <button type="button" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button type="button" onClick={requestPreview} disabled={busy || !destId}>
          {busy ? "Pricing…" : "Review move"}
        </button>
      </div>
    </div>
  );
}
