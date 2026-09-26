"use client";

import React, { useMemo, useRef, useState } from "react";
import { ApiRequestError } from "@/lib/apiClient";
import { validateConvertAmount } from "@/lib/services/conversions";
import type { FinancialAccount } from "@/lib/services/entities";
import { formatNetworkLabel } from "@/lib/services/entities";
import {
  parseBulkStellarPayoutCsvLoose,
  stellarDisbursementsApi,
  type BulkStellarPayoutBatch,
  type BulkStellarPayoutPreview,
  type BulkStellarPayoutRow,
} from "@/lib/services/stellarDisbursements";

// Local-only identity for React keys / focus stability across edits, add,
// and remove — never sent to the API (stripped in previewBatch).
type EditableRow = BulkStellarPayoutRow & { __id: number };

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

function emptyRow(): BulkStellarPayoutRow {
  return { destination: "", amount: "", memo: "", reference: "" };
}

function stripLocalId(row: EditableRow): BulkStellarPayoutRow {
  const { destination, amount, memo, reference } = row;
  return { destination, amount, memo, reference };
}

function isBlankRow(row: BulkStellarPayoutRow): boolean {
  return !row.destination.trim() && !row.amount.trim() && !row.memo?.trim() && !row.reference?.trim();
}

export default function BulkStellarPayoutWizard({
  sourceAccounts,
  onDone,
  onCancel,
}: BulkStellarPayoutWizardProps) {
  const [sourceAccountId, setSourceAccountId] = useState(sourceAccounts[0]?.id || "");
  const [csvText, setCsvText] = useState("");
  const [parsedRows, setParsedRows] = useState<EditableRow[]>([]);
  const [rowsMode, setRowsMode] = useState(false);
  const [preview, setPreview] = useState<BulkStellarPayoutPreview | null>(null);
  const [batch, setBatch] = useState<BulkStellarPayoutBatch | null>(null);
  const [busy, setBusy] = useState<"preview" | "confirm" | "upload" | null>(null);
  const [error, setError] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const nextRowId = useRef(0);

  const selectedAccount = useMemo(
    () => sourceAccounts.find((account) => account.id === sourceAccountId) || null,
    [sourceAccountId, sourceAccounts],
  );

  const withLocalIds = (rows: BulkStellarPayoutRow[]): EditableRow[] =>
    rows.map((row) => ({ ...row, __id: nextRowId.current++ }));

  const loadRowsFromCsv = (text: string) => {
    try {
      const rows = parseBulkStellarPayoutCsvLoose(text);
      setParsedRows(withLocalIds(rows));
      setRowsMode(true);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't parse that CSV.");
    }
  };

  const startManualEntry = () => {
    setParsedRows(withLocalIds([emptyRow()]));
    setRowsMode(true);
    setError("");
  };

  const readCsvFile = async (file: File) => {
    setBusy("upload");
    setError("");
    try {
      const text = await file.text();
      setCsvText(text);
      loadRowsFromCsv(text);
    } catch {
      setError("Couldn't read that CSV file.");
    } finally {
      setBusy(null);
    }
  };

  const onUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await readCsvFile(file);
    event.target.value = "";
  };

  const onDropCsv = async (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setDragActive(false);
    const file = event.dataTransfer.files?.[0];
    if (!file) return;
    await readCsvFile(file);
  };

  const downloadSampleCsv = () => {
    const sample = [
      "destination,amount,memo,reference",
      "REPLACE_WITH_STELLAR_ADDRESS,25.00,Payroll,ops-001",
      "REPLACE_WITH_STELLAR_ADDRESS,10.50,Vendor payment,inv-2045",
    ].join("\n");
    const blob = new Blob([sample], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "mboka-bulk-payout-sample.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
  };

  const updateRow = (index: number, field: keyof BulkStellarPayoutRow, value: string) => {
    setParsedRows((rows) => rows.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  };

  const removeRow = (index: number) => {
    setParsedRows((rows) => rows.filter((_, i) => i !== index));
  };

  const addRow = () => {
    setParsedRows((rows) => [...rows, ...withLocalIds([emptyRow()])]);
  };

  const clearRows = () => {
    setParsedRows([]);
    setCsvText("");
    setError("");
    setRowsMode(false);
  };

  const reviewPastedCsv = () => {
    if (!csvText.trim()) return;
    loadRowsFromCsv(csvText);
  };

  const previewBatch = async () => {
    if (!sourceAccountId || !selectedAccount) {
      setError("Choose the source account first.");
      return;
    }
    // Walk parsedRows in its own order so a reported row number always
    // matches what's on screen — skipping blank rows must not renumber the
    // real ones after it.
    const rows: BulkStellarPayoutRow[] = [];
    for (let i = 0; i < parsedRows.length; i += 1) {
      const row = parsedRows[i];
      if (isBlankRow(row)) continue;
      if (!row.destination.trim() || !row.amount.trim()) {
        setError(`Row ${i + 1} needs a destination and an amount.`);
        return;
      }
      try {
        validateConvertAmount(row.amount);
      } catch (err) {
        setError(
          `Row ${i + 1}: ${err instanceof Error ? err.message : "invalid amount."}`,
        );
        return;
      }
      rows.push(stripLocalId(row));
    }
    if (!rows.length) {
      setError("Add at least one payout row.");
      return;
    }
    setBusy("preview");
    setError("");
    try {
      const nextPreview = await stellarDisbursementsApi.preview(
        selectedAccount.entityId,
        sourceAccountId,
        rows,
      );
      setParsedRows(withLocalIds(rows));
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

  const stage: "input" | "edit" | "preview" = preview ? "preview" : rowsMode ? "edit" : "input";

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
          disabled={stage === "preview" || busy === "confirm"}
        >
          {sourceAccounts.map((account) => (
            <option key={account.id} value={account.id}>
              {walletLabel(account)}
            </option>
          ))}
        </select>
      </label>

      {stage === "input" ? (
        <>
          <label
            className={`ep-dropzone${dragActive ? " ep-dropzone--active" : ""}`}
            onDragOver={(event) => {
              event.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(event) => void onDropCsv(event)}
          >
            <span className="ep-dropzone__title">
              {busy === "upload" ? "Reading CSV…" : "Drop a CSV file here, or click to browse"}
            </span>
            <span className="ep-dropzone__hint">destination, amount, memo, reference</span>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={onUpload}
              disabled={busy === "upload"}
              style={{ display: "none" }}
            />
          </label>

          <div className="ep-chip-row">
            <button
              type="button"
              className="ep-btn-secondary"
              style={{ width: "fit-content" }}
              onClick={downloadSampleCsv}
            >
              Download sample CSV
            </button>
            <button
              type="button"
              className="ep-btn-secondary"
              style={{ width: "fit-content" }}
              onClick={startManualEntry}
              disabled={busy === "upload"}
            >
              + Add a recipient manually
            </button>
          </div>

          <label className="ep-field">
            <span>Or paste CSV</span>
            <textarea
              value={csvText}
              onChange={(event) => setCsvText(event.target.value)}
              placeholder={"destination,amount,memo,reference\nG...,25.00,Payroll,ops-001"}
              rows={8}
              disabled={busy === "upload"}
            />
          </label>
        </>
      ) : stage === "edit" ? (
        <>
          <div className="ep-row-table-wrap">
            <table className="ep-row-table" aria-label="Bulk payout rows">
              <thead>
                <tr>
                  <th>Destination</th>
                  <th>Amount</th>
                  <th>Memo</th>
                  <th>Reference</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {parsedRows.map((row, index) => (
                  <tr key={row.__id}>
                    <td>
                      <input
                        value={row.destination}
                        onChange={(event) => updateRow(index, "destination", event.target.value)}
                        placeholder="Destination address"
                        aria-label={`Row ${index + 1} destination`}
                        disabled={busy === "preview"}
                      />
                    </td>
                    <td>
                      <input
                        value={row.amount}
                        onChange={(event) => updateRow(index, "amount", event.target.value)}
                        placeholder="Amount"
                        inputMode="decimal"
                        aria-label={`Row ${index + 1} amount`}
                        disabled={busy === "preview"}
                      />
                    </td>
                    <td>
                      <input
                        value={row.memo || ""}
                        onChange={(event) => updateRow(index, "memo", event.target.value)}
                        placeholder="Optional"
                        aria-label={`Row ${index + 1} memo`}
                        disabled={busy === "preview"}
                      />
                    </td>
                    <td>
                      <input
                        value={row.reference || ""}
                        onChange={(event) => updateRow(index, "reference", event.target.value)}
                        placeholder="Optional"
                        aria-label={`Row ${index + 1} reference`}
                        disabled={busy === "preview"}
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        className="ep-row-table__remove"
                        onClick={() => removeRow(index)}
                        aria-label={`Remove row ${index + 1}`}
                        disabled={busy === "preview"}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            type="button"
            className="ep-btn-secondary"
            onClick={addRow}
            style={{ width: "fit-content" }}
            disabled={busy === "preview"}
          >
            + Add row
          </button>
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
              {preview?.total_amount || sumAmounts(parsedRows)} {preview?.currency}
            </span>
          </div>
          {parsedRows.map((row) => (
            <div key={row.__id} className="ep-money-review__row">
              <span className="ep-money-review__k">{row.destination}</span>
              <span className="ep-money-review__v">
                {row.amount} {preview?.currency}
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
          onClick={
            stage === "preview"
              ? () => setPreview(null)
              : stage === "edit"
                ? clearRows
                : onCancel
          }
          disabled={busy === "preview" || busy === "confirm"}
        >
          {stage === "input" ? "Cancel" : "Back"}
        </button>
        <button
          type="button"
          onClick={
            stage === "preview"
              ? () => void confirmBatch()
              : stage === "edit"
                ? () => void previewBatch()
                : reviewPastedCsv
          }
          disabled={
            busy === "preview" ||
            busy === "confirm" ||
            busy === "upload" ||
            (stage === "input" && !csvText.trim())
          }
        >
          {busy === "upload"
            ? "Reading CSV..."
            : busy === "preview"
              ? "Previewing..."
              : busy === "confirm"
                ? "Submitting..."
                : stage === "preview"
                  ? "Confirm batch"
                  : stage === "edit"
                    ? "Preview batch"
                    : "Review rows"}
        </button>
      </div>
    </div>
  );
}
