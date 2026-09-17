"use client";

import React, { useMemo, useState } from "react";
import { bookTransfersApi } from "@/lib/services/bookTransfers";
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

  const submit = async () => {
    setError("");
    if (!destId || !amount.trim()) {
      setError("Choose a destination and amount.");
      return;
    }
    setBusy(true);
    try {
      const preview = await bookTransfersApi.preview(entityId, source.id, {
        destination_account_id: destId,
        amount: amount.trim(),
        currency: source.currency,
      });
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
      {status ? <p className="ep-muted">Status: {status}</p> : null}
      <div className="ep-modal-actions">
        <button type="button" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button type="button" onClick={submit} disabled={busy || !destId}>
          {busy ? "Moving…" : "Confirm move"}
        </button>
      </div>
    </div>
  );
}
