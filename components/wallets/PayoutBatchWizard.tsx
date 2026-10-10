"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { ApiRequestError } from "@/lib/apiClient";
import { validateConvertAmount } from "@/lib/services/conversions";
import type { FinancialAccount } from "@/lib/services/entities";
import { formatNetworkLabel } from "@/lib/services/entities";
import {
  explainPayoutFailure,
  isTransientDisbursementError,
  newBulkPayoutIdempotencyKey,
  parseMixedPayoutCsvLoose,
  payoutBatchesApi,
  railLabel,
  resolvePayoutRail,
  sampleMixedPayoutCsv,
  withTransientRetry,
  type MixedPayoutBatch,
  type MixedPayoutPreview,
  type MixedPayoutRow,
  type PayoutRail,
} from "@/lib/services/payoutBatches";
import { stellarExplorerTxUrl } from "@/lib/stellar/network";

type EditableRow = MixedPayoutRow & { __id: number };
type WizardStage = "input" | "edit" | "preview";

type Props = {
  sourceAccounts: FinancialAccount[];
  onDone: () => void;
  onCancel: () => void;
};

const STEPS = [
  { id: "input" as const, label: "Recipients" },
  { id: "edit" as const, label: "Review rows" },
  { id: "preview" as const, label: "Confirm" },
];

function walletLabel(account: FinancialAccount): string {
  return `${account.currency} · ${formatNetworkLabel(account.network)} · ${account.id}`;
}

function emptyRow(): MixedPayoutRow {
  return {
    destination: "",
    phone: "",
    bank_account_number: "",
    bank_code: "",
    country: "",
    amount: "",
    currency: "USDC",
    recipient_name: "",
    memo: "",
    reference: "",
  };
}

function stripLocalId(row: EditableRow): MixedPayoutRow {
  const { __id: _id, ...rest } = row;
  return rest;
}

function isBlankRow(row: MixedPayoutRow): boolean {
  return !(
    row.destination?.trim() ||
    row.phone?.trim() ||
    row.bank_account_number?.trim() ||
    row.bank_code?.trim() ||
    row.amount?.trim() ||
    row.recipient_name?.trim() ||
    row.memo?.trim() ||
    row.reference?.trim()
  );
}

function stepIndex(stage: WizardStage): number {
  return STEPS.findIndex((s) => s.id === stage);
}

function RailBadge({ rail }: { rail: PayoutRail | null }) {
  const tone =
    rail === "stellar" ? "stellar" : rail === "mobile_money" ? "momo" : rail === "bank" ? "bank" : "none";
  return (
    <span className={`ep-bulk-result__badge ep-rail-badge ep-rail-badge--${tone}`}>
      {railLabel(rail)}
    </span>
  );
}

function SubmittingHourglass() {
  return (
    <span className="ep-bulk-hourglass" aria-hidden>
      <Image
        src="/brand/bulk-payout-hourglass.png"
        alt=""
        width={22}
        height={22}
        className="ep-bulk-hourglass__img"
        unoptimized
      />
    </span>
  );
}

function BatchResult({
  batch: initial,
  network,
  entityId,
  accountId,
  onDone,
}: {
  batch: MixedPayoutBatch;
  network?: string | null;
  entityId: string;
  accountId: string;
  onDone: () => void;
}) {
  const [batch, setBatch] = useState(initial);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState("");

  const refreshStatus = async () => {
    if (!entityId || !accountId || !batch.batch_id || refreshing) return;
    setRefreshing(true);
    setRefreshError("");
    try {
      const next = await withTransientRetry(() =>
        payoutBatchesApi.syncBatch(entityId, accountId, batch.batch_id),
      );
      setBatch(next);
    } catch (err) {
      setRefreshError(
        err instanceof ApiRequestError || err instanceof Error
          ? err.message
          : "Couldn't refresh batch status.",
      );
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="ep-money-flow ep-bulk-payout">
      <div className="ep-bulk-result">
        <div className="ep-bulk-result__hero">
          <div>
            <div className="ep-bulk-result__title">Batch {batch.batch_id}</div>
            <div className="ep-bulk-result__summary">
              Status: {batch.status} · {batch.stellar_item_count} Stellar ·{" "}
              {batch.fiat_item_count} mobile money
            </div>
          </div>
        </div>
        <ul className="ep-bulk-result__list" aria-label="Payout results">
          {batch.items.map((item) => {
            const rowKey = `${item.row_index}-${item.recipient_label}`;
            const open = openKey === rowKey;
            const failed = ["failed", "error", "rejected"].includes(
              (item.status || "").toLowerCase(),
            );
            const explorerUrl =
              item.rail === "stellar" && item.tx_hash
                ? stellarExplorerTxUrl({ txHash: item.tx_hash, network: network || "Stellar" })
                : null;
            return (
              <li key={rowKey} className="ep-bulk-result__row">
                <div className="ep-bulk-result__main">
                  <div className="ep-bulk-result__top">
                    <span className="ep-bulk-payout__addr" title={item.recipient_label}>
                      {item.recipient_label}
                    </span>
                    <span className="ep-bulk-result__meta">
                      <RailBadge rail={item.rail} />
                      <span className="ep-bulk-result__amount">
                        {item.amount} {item.currency}
                      </span>
                      <span className="ep-bulk-result__badge">{item.status}</span>
                      {failed ? (
                        <button
                          type="button"
                          className="ep-bulk-result__why-btn"
                          onClick={() => setOpenKey(open ? null : rowKey)}
                        >
                          {open ? "Hide" : "Why?"}
                        </button>
                      ) : null}
                      {explorerUrl ? (
                        <a
                          className="ep-bulk-result__onchain"
                          href={explorerUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          View onchain ↗
                        </a>
                      ) : null}
                    </span>
                  </div>
                  {open ? (
                    <div className="ep-bulk-result__why-panel" role="region">
                      {explainPayoutFailure(item.failure_code || item.last_error, item.rail) ||
                        item.last_error ||
                        "No further detail available."}
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
      {refreshError ? (
        <div className="ep-money-banner ep-money-banner--error" role="alert">
          {refreshError}
        </div>
      ) : null}
      <div className="ep-money-actions ep-bulk-payout__actions">
        <button type="button" className="ep-btn-primary" onClick={onDone}>
          Done
        </button>
        <button
          type="button"
          className="ep-btn-secondary"
          onClick={() => void refreshStatus()}
          disabled={refreshing || !batch.batch_id}
        >
          {refreshing ? "Refreshing…" : "Refresh status"}
        </button>
      </div>
    </div>
  );
}

export default function PayoutBatchWizard({ sourceAccounts, onDone, onCancel }: Props) {
  const [sourceAccountId, setSourceAccountId] = useState(sourceAccounts[0]?.id || "");
  const [csvText, setCsvText] = useState("");
  const [parsedRows, setParsedRows] = useState<EditableRow[]>([]);
  const [rowsMode, setRowsMode] = useState(false);
  const [preview, setPreview] = useState<MixedPayoutPreview | null>(null);
  const [batch, setBatch] = useState<MixedPayoutBatch | null>(null);
  const [busy, setBusy] = useState<"preview" | "confirm" | "upload" | null>(null);
  const [error, setError] = useState("");
  const [safeConfirmRetry, setSafeConfirmRetry] = useState(false);
  const idempotencyKeyRef = useRef<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const nextRowId = useRef(0);

  const selectedAccount = useMemo(
    () => sourceAccounts.find((account) => account.id === sourceAccountId) || null,
    [sourceAccountId, sourceAccounts],
  );

  useEffect(() => {
    if (!sourceAccounts.length) return;
    const stillValid = sourceAccounts.some((account) => account.id === sourceAccountId);
    if (!stillValid) setSourceAccountId(sourceAccounts[0].id);
  }, [sourceAccounts, sourceAccountId]);

  const withLocalIds = (rows: MixedPayoutRow[]): EditableRow[] =>
    rows.map((row) => ({ ...row, __id: nextRowId.current++ }));

  const stage: WizardStage = preview ? "preview" : rowsMode ? "edit" : "input";

  const loadRowsFromCsv = (text: string) => {
    try {
      setParsedRows(withLocalIds(parseMixedPayoutCsvLoose(text)));
      setRowsMode(true);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't parse that CSV.");
    }
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

  const downloadSampleCsv = () => {
    const blob = new Blob([sampleMixedPayoutCsv() + "\n"], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "mixed-rail-bulk-payout-sample.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
  };

  const updateRow = (index: number, field: keyof MixedPayoutRow, value: string) => {
    setParsedRows((rows) => rows.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  };

  const rowRailIssues = useMemo(() => {
    return parsedRows.map((row) => {
      if (isBlankRow(row)) return null;
      const resolution = resolvePayoutRail(row);
      if (resolution.error) return resolution.error;
      if (resolution.rail === "bank") {
        return "Bank transfers aren't supported in bulk payouts yet.";
      }
      return null;
    });
  }, [parsedRows]);

  const previewBlocked = rowRailIssues.some(Boolean);

  const previewBatch = async () => {
    const account = selectedAccount || sourceAccounts[0] || null;
    if (!account) {
      setError("Choose the source account first.");
      return;
    }
    const rows: MixedPayoutRow[] = [];
    for (let i = 0; i < parsedRows.length; i += 1) {
      const row = parsedRows[i];
      if (isBlankRow(row)) continue;
      const resolution = resolvePayoutRail(row);
      if (resolution.error || !resolution.rail) {
        setError(`Row ${i + 1}: ${resolution.error || "unresolved rail."}`);
        return;
      }
      if (resolution.rail === "bank") {
        setError(`Row ${i + 1}: bank transfers aren't supported yet.`);
        return;
      }
      try {
        validateConvertAmount(row.amount);
      } catch (err) {
        setError(`Row ${i + 1}: ${err instanceof Error ? err.message : "invalid amount."}`);
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
    setSafeConfirmRetry(false);
    idempotencyKeyRef.current = newBulkPayoutIdempotencyKey();
    try {
      const next = await withTransientRetry(() =>
        payoutBatchesApi.preview(account.entityId, account.id, rows, {
          idempotencyKey: idempotencyKeyRef.current || undefined,
        }),
      );
      setParsedRows(withLocalIds(rows));
      setPreview(next);
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
    const account = selectedAccount || sourceAccounts[0] || null;
    if (!preview?.preview_token || !account) return;
    setBusy("confirm");
    setError("");
    setSafeConfirmRetry(false);
    try {
      const next = await withTransientRetry(() =>
        payoutBatchesApi.confirm(account.entityId, account.id, preview.preview_token),
      );
      idempotencyKeyRef.current = null;
      setBatch(next);
    } catch (err) {
      if (isTransientDisbursementError(err)) {
        setSafeConfirmRetry(true);
        setError(
          "Timed out waiting for confirmation. Retry safely — this won’t send the batch twice.",
        );
      } else {
        setError(
          err instanceof ApiRequestError || err instanceof Error
            ? err.message
            : "Couldn't submit this batch.",
        );
      }
    } finally {
      setBusy(null);
    }
  };

  if (!sourceAccounts.length) {
    return (
      <div className="ep-money-flow ep-bulk-payout">
        <div className="ep-wallets__empty">
          <div className="ep-wallets__empty-title">Stellar wallet needed</div>
          <div className="ep-wallets__empty-body">
            Open a ready Stellar stablecoin wallet before submitting a bulk payout batch.
          </div>
        </div>
        <div className="ep-money-actions">
          <button type="button" className="ep-btn-primary" onClick={onCancel}>
            Close
          </button>
        </div>
      </div>
    );
  }

  if (batch) {
    return (
      <BatchResult
        batch={batch}
        network={selectedAccount?.network || "Stellar"}
        entityId={selectedAccount?.entityId || ""}
        accountId={selectedAccount?.id || sourceAccountId}
        onDone={onDone}
      />
    );
  }

  const primaryDisabled =
    busy !== null ||
    (stage === "input" && !csvText.trim()) ||
    (stage === "edit" && (parsedRows.every(isBlankRow) || previewBlocked));

  return (
    <div className="ep-money-flow ep-bulk-payout">
      <p className="ep-fund-chooser__intro">
        Pay Stellar wallets and mobile-money recipients from one CSV. Each row picks its rail from
        the columns you fill in.
      </p>

      {error ? (
        <div className="ep-money-banner ep-money-banner--error" role="alert">
          {error}
        </div>
      ) : null}

      {busy === "confirm" ? (
        <div className="ep-bulk-processing" role="status">
          <SubmittingHourglass />
          <div>
            <div className="ep-bulk-processing__title">Submitting batch…</div>
            <div className="ep-bulk-processing__body">Keep this window open.</div>
          </div>
        </div>
      ) : null}

      {stage === "input" ? (
        <>
          {sourceAccounts.length > 1 ? (
            <label className="ep-field">
              <span>Source wallet</span>
              <select
                value={sourceAccountId}
                onChange={(e) => setSourceAccountId(e.target.value)}
              >
                {sourceAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {walletLabel(account)}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label
            className={`ep-bulk-payout__dropzone${dragActive ? " ep-bulk-payout__dropzone--active" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragActive(false);
              const file = e.dataTransfer.files?.[0];
              if (file) void readCsvFile(file);
            }}
          >
            <input type="file" accept=".csv,text/csv" hidden onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void readCsvFile(file);
              e.target.value = "";
            }} />
            Drop a CSV here or click to upload
          </label>
          <textarea
            className="ep-field"
            rows={8}
            placeholder={sampleMixedPayoutCsv()}
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
          />
          <div className="ep-money-actions">
            <button type="button" className="ep-btn-secondary" onClick={downloadSampleCsv}>
              Download sample CSV
            </button>
            <button
              type="button"
              className="ep-btn-secondary"
              onClick={() => {
                setParsedRows(withLocalIds([emptyRow()]));
                setRowsMode(true);
              }}
            >
              Enter rows manually
            </button>
          </div>
        </>
      ) : null}

      {stage === "edit" ? (
        <div className="ep-bulk-payout__edit">
          <div className="ep-bulk-payout__table-wrap">
            <table className="ep-bulk-payout__table">
              <thead>
                <tr>
                  <th>Rail</th>
                  <th>Destination</th>
                  <th>Phone</th>
                  <th>Country</th>
                  <th>Amount</th>
                  <th>Currency</th>
                  <th>Name</th>
                  <th>Reference</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {parsedRows.map((row, index) => {
                  const resolution = isBlankRow(row) ? null : resolvePayoutRail(row);
                  return (
                    <tr key={row.__id}>
                      <td>
                        <RailBadge rail={resolution?.rail ?? null} />
                        {rowRailIssues[index] ? (
                          <div className="ep-muted" style={{ fontSize: 12, maxWidth: 140 }}>
                            {rowRailIssues[index]}
                          </div>
                        ) : null}
                      </td>
                      <td>
                        <input
                          value={row.destination || ""}
                          onChange={(e) => updateRow(index, "destination", e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          value={row.phone || ""}
                          onChange={(e) => updateRow(index, "phone", e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          value={row.country || ""}
                          onChange={(e) => updateRow(index, "country", e.target.value)}
                          style={{ width: 56 }}
                        />
                      </td>
                      <td>
                        <input
                          value={row.amount}
                          onChange={(e) => updateRow(index, "amount", e.target.value)}
                          style={{ width: 88 }}
                        />
                      </td>
                      <td>
                        <input
                          value={row.currency}
                          onChange={(e) => updateRow(index, "currency", e.target.value)}
                          style={{ width: 64 }}
                        />
                      </td>
                      <td>
                        <input
                          value={row.recipient_name || ""}
                          onChange={(e) => updateRow(index, "recipient_name", e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          value={row.reference || ""}
                          onChange={(e) => updateRow(index, "reference", e.target.value)}
                        />
                      </td>
                      <td>
                        <button
                          type="button"
                          className="ep-btn-secondary"
                          onClick={() =>
                            setParsedRows((rows) => rows.filter((_, i) => i !== index))
                          }
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <button
            type="button"
            className="ep-btn-secondary"
            onClick={() => setParsedRows((rows) => [...rows, ...withLocalIds([emptyRow()])])}
          >
            Add row
          </button>
        </div>
      ) : null}

      {stage === "preview" && preview ? (
        <ul className="ep-bulk-result__list" aria-label="Preview rows">
          {preview.items.map((item) => (
            <li key={item.row_index} className="ep-bulk-result__row">
              <div className="ep-bulk-result__main">
                <div className="ep-bulk-result__top">
                  <span className="ep-bulk-payout__addr">{item.recipient_label}</span>
                  <span className="ep-bulk-result__meta">
                    <RailBadge rail={item.rail} />
                    <span className="ep-bulk-result__amount">
                      {item.amount} {item.currency}
                    </span>
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="ep-money-actions ep-bulk-payout__actions">
        <button
          type="button"
          className="ep-btn-secondary"
          onClick={() => {
            if (stage === "preview") {
              setPreview(null);
              return;
            }
            if (stage === "edit") {
              setRowsMode(false);
              return;
            }
            onCancel();
          }}
          disabled={busy === "confirm"}
        >
          {stage === "input" ? "Cancel" : "Back"}
        </button>
        <button
          type="button"
          className="ep-btn-primary"
          disabled={primaryDisabled}
          onClick={() => {
            if (stage === "input") {
              loadRowsFromCsv(csvText);
              return;
            }
            if (stage === "edit") {
              void previewBatch();
              return;
            }
            void confirmBatch();
          }}
        >
          {busy === "preview"
            ? "Previewing…"
            : busy === "confirm"
              ? "Submitting…"
              : stage === "preview"
                ? safeConfirmRetry
                  ? "Retry confirm"
                  : "Confirm batch"
                : stage === "edit"
                  ? "Preview batch"
                  : "Review rows"}
        </button>
      </div>
    </div>
  );
}
