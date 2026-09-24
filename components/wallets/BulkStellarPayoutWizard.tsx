"use client";

import React, { useMemo, useState } from "react";
import { ApiRequestError } from "@/lib/apiClient";
import type { FinancialAccount } from "@/lib/services/entities";
import { formatNetworkLabel } from "@/lib/services/entities";
import {
  parseBulkStellarPayoutCsv,
  stellarDisbursementsApi,
  type BulkStellarPayoutBatch,
  type BulkStellarPayoutPreview,
  type BulkStellarPayoutRow,
} from "@/lib/services/stellarDisbursements";

type BulkStellarPayoutWizardProps = {
  sourceAccounts: FinancialAccount[];
  onDone: () => void;
  onCancel: () => void;
};

function walletLabel(account: FinancialAccount): string {
  return `${account.currency} · ${formatNetworkLabel(account.network)} · ${account.id}`;
}

function sumAmounts(rows: BulkStellarPayoutRow[]): string {
  const total = rows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  return total.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function BulkStellarPayoutWizard({
  sourceAccounts,
  onDone,
  onCancel,
}: BulkStellarPayoutWizardProps) {
  const [sourceAccountId, setSourceAccountId] = useState(sourceAccounts[0]?.id || "");
  const [csvText, setCsvText] = useState("");
  const [parsedRows, setParsedRows] = useState<BulkStellarPayoutRow[]>([]);
  const [preview, setPreview] = useState<BulkStellarPayoutPreview | null>(null);
  const [batch, setBatch] = useState<BulkStellarPayoutBatch | null>(null);
  const [busy, setBusy] = useState<"preview" | "confirm" | "upload" | null>(null);
  const [error, setError] = useState("");

  const selectedAccount = useMemo(
    () => sourceAccounts.find((account) => account.id === sourceAccountId) || null,
    [sourceAccountId, sourceAccounts],
  );

  const onUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy("upload");
    setError("");
    try {
      const text = await file.text();
      setCsvText(text);
    } catch {
      setError("Couldn't read that CSV file.");
    } finally {
      setBusy(null);
      event.target.value = "";
    }
  };

  const previewBatch = async () => {
    if (!sourceAccountId || !selectedAccount) {
      setError("Choose the Stellar source wallet first.");
      return;
    }
    setBusy("preview");
    setError("");
    try {
      const rows = parseBulkStellarPayoutCsv(csvText);
      const nextPreview = await stellarDisbursementsApi.preview(
        selectedAccount.entityId,
        sourceAccountId,
        rows,
      );
      setParsedRows(rows);
      setPreview(nextPreview);
    } catch (err) {
      setError(
        err instanceof ApiRequestError || err instanceof Error
          ? err.message
          : "Couldn't preview this batch.",
      );
    } finally {
      setBusy(null);
    }
  };

  const confirmBatch = async () => {
    if (!preview?.preview_token || !sourceAccountId || !selectedAccount) return;
    setBusy("confirm");
    setError("");
    try {
      const nextBatch = await stellarDisbursementsApi.confirm(
        selectedAccount.entityId,
        sourceAccountId,
        preview.preview_token,
      );
      setBatch(nextBatch);
    } catch (err) {
      setError(
        err instanceof ApiRequestError || err instanceof Error
          ? err.message
          : "Couldn't submit this batch.",
      );
    } finally {
      setBusy(null);
    }
  };

  if (!sourceAccounts.length) {
    return (
      <div className="ep-wallets__empty">
        <div className="ep-wallets__empty-title">Stellar wallet needed</div>
        <div className="ep-wallets__empty-body">
          Open a ready Stellar stablecoin wallet before submitting a bulk payout batch.
        </div>
        <button type="button" className="ep-btn-secondary" onClick={onCancel}>
          Close
        </button>
      </div>
    );
  }

  if (batch) {
    return (
      <div className="ep-money-success">
        <span className="ep-money-success__title">Bulk batch submitted</span>
        <span className="ep-money-success__body">
          Batch {batch.batch_id || "pending"} is {batch.status}.
        </span>
        <div className="ep-money-kv" role="group" aria-label="Batch status list">
          {batch.items.map((item, index) => (
            <div key={`${item.destination}-${index}`} className="ep-money-kv__row">
              <span className="ep-money-kv__k">{item.destination}</span>
              <span className="ep-money-kv__v">
                {item.amount} {selectedAccount?.currency || "USDC"}
                {item.status ? ` · ${item.status}` : ""}
              </span>
            </div>
          ))}
        </div>
        <button type="button" className="ep-btn-secondary" onClick={onDone}>
          Done
        </button>
      </div>
    );
  }

  return (
    <div className="ep-money-stack">
      <p className="ep-fund-chooser__intro">
        Bulk disburse on Stellar from {selectedAccount ? walletLabel(selectedAccount) : "your wallet"}.
      </p>
      <p className="ep-muted" role="note">
        CSV columns: destination, amount, memo, reference.
      </p>

      <label className="ep-field">
        <span>Source wallet</span>
        <select
          value={sourceAccountId}
          onChange={(event) => setSourceAccountId(event.target.value)}
          disabled={Boolean(preview) || busy === "confirm"}
        >
          {sourceAccounts.map((account) => (
            <option key={account.id} value={account.id}>
              {walletLabel(account)}
            </option>
          ))}
        </select>
      </label>

      {!preview ? (
        <>
          <label className="ep-field">
            <span>Paste CSV</span>
            <textarea
              value={csvText}
              onChange={(event) => setCsvText(event.target.value)}
              placeholder={"destination,amount,memo,reference\nG...,25.00,Payroll,ops-001"}
              rows={8}
              disabled={busy === "preview" || busy === "upload"}
            />
          </label>

          <label className="ep-btn-secondary" style={{ width: "fit-content", cursor: "pointer" }}>
            Upload CSV
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={onUpload}
              disabled={busy === "preview" || busy === "upload"}
              style={{ display: "none" }}
            />
          </label>
        </>
      ) : (
        <div className="ep-money-review" role="group" aria-label="Bulk payout preview">
          <div className="ep-money-review__row">
            <span className="ep-money-review__k">Rows</span>
            <span className="ep-money-review__v">{parsedRows.length}</span>
          </div>
          <div className="ep-money-review__row">
            <span className="ep-money-review__k">Total</span>
            <span className="ep-money-review__v">
              {preview.total_amount || sumAmounts(parsedRows)} {preview.currency}
            </span>
          </div>
          {parsedRows.map((row, index) => (
            <div key={`${row.destination}-${index}`} className="ep-money-review__row">
              <span className="ep-money-review__k">{row.destination}</span>
              <span className="ep-money-review__v">
                {row.amount} {preview.currency}
                {row.memo ? ` · ${row.memo}` : ""}
              </span>
            </div>
          ))}
        </div>
      )}

      {error ? (
        <div className="ep-money-banner ep-money-banner--danger" role="alert">
          {error}
        </div>
      ) : null}

      <div className="ep-modal-actions">
        <button
          type="button"
          onClick={preview ? () => setPreview(null) : onCancel}
          disabled={busy === "preview" || busy === "confirm"}
        >
          {preview ? "Back" : "Cancel"}
        </button>
        <button
          type="button"
          onClick={preview ? () => void confirmBatch() : () => void previewBatch()}
          disabled={busy === "preview" || busy === "confirm"}
        >
          {busy === "upload"
            ? "Reading CSV..."
            : busy === "preview"
              ? "Previewing..."
              : busy === "confirm"
                ? "Submitting..."
                : preview
                  ? "Confirm batch"
                  : "Preview batch"}
        </button>
      </div>
    </div>
  );
}
