"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { ApiRequestError } from "@/lib/apiClient";
import {
  clearBulkPayoutDraft,
  draftSummary,
  readBulkPayoutDraft,
  writeBulkPayoutDraft,
  type BulkPayoutDraft,
} from "@/lib/services/bulkPayoutDraft";
import { validateConvertAmount } from "@/lib/services/conversions";
import type { FinancialAccount } from "@/lib/services/entities";
import { formatNetworkLabel } from "@/lib/services/entities";
import {
  explainDisbursementFailure,
  parseBulkStellarPayoutCsvLoose,
  stellarDisbursementsApi,
  type BulkStellarPayoutBatch,
  type BulkStellarPayoutPreview,
  type BulkStellarPayoutRow,
} from "@/lib/services/stellarDisbursements";

// Local-only identity for React keys / focus stability across edits, add,
// and remove — never sent to the API (stripped in previewBatch).
type EditableRow = BulkStellarPayoutRow & { __id: number };

type WizardStage = "input" | "edit" | "preview";

type BulkStellarPayoutWizardProps = {
  sourceAccounts: FinancialAccount[];
  /** Business / tenant id for sessionStorage draft scope. Omit = no persistence. */
  draftScopeId?: string | number | null;
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

function stepIndex(stage: WizardStage): number {
  return STEPS.findIndex((s) => s.id === stage);
}

function BulkPayoutStepper({
  stage,
  onStepClick,
  subline,
}: {
  stage: WizardStage;
  onStepClick: (target: WizardStage) => void;
  subline: string;
}) {
  const current = stepIndex(stage);
  return (
    <div className="ep-bulk-stepper">
      <ol className="ep-bulk-stepper__list" aria-label="Bulk payout steps">
        {STEPS.map((step, index) => {
          const done = index < current;
          const active = index === current;
          const clickable = done;
          return (
            <li
              key={step.id}
              className={[
                "ep-bulk-stepper__item",
                active ? "ep-bulk-stepper__item--current" : "",
                done ? "ep-bulk-stepper__item--done" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {index > 0 ? <span className="ep-bulk-stepper__rail" aria-hidden /> : null}
              <button
                type="button"
                className="ep-bulk-stepper__btn"
                disabled={!clickable}
                onClick={() => clickable && onStepClick(step.id)}
                aria-current={active ? "step" : undefined}
              >
                <span className="ep-bulk-stepper__mark" aria-hidden>
                  {done ? "✓" : index + 1}
                </span>
                <span className="ep-bulk-stepper__label">{step.label}</span>
              </button>
            </li>
          );
        })}
      </ol>
      <p className="ep-bulk-stepper__subline">{subline}</p>
    </div>
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

export default function BulkStellarPayoutWizard({
  sourceAccounts,
  draftScopeId = null,
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
  const [pendingDraft, setPendingDraft] = useState<BulkPayoutDraft | null>(null);
  const nextRowId = useRef(0);
  const hydrated = useRef(false);

  const selectedAccount = useMemo(
    () => sourceAccounts.find((account) => account.id === sourceAccountId) || null,
    [sourceAccountId, sourceAccounts],
  );

  // Accounts often arrive after mount (entity list). useState(initial) only
  // runs once — empty id + a populated <select> looks selected in the UI but
  // previewBatch fails with "Choose the source account first."
  useEffect(() => {
    if (!sourceAccounts.length) return;
    const stillValid = sourceAccounts.some((account) => account.id === sourceAccountId);
    if (!stillValid) {
      setSourceAccountId(sourceAccounts[0].id);
    }
  }, [sourceAccounts, sourceAccountId]);

  const withLocalIds = (rows: BulkStellarPayoutRow[]): EditableRow[] =>
    rows.map((row) => ({ ...row, __id: nextRowId.current++ }));

  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    const draft = readBulkPayoutDraft(draftScopeId);
    if (!draft) return;
    const { rows } = draftSummary(draft);
    if (rows === 0 && !draft.csvText.trim()) return;
    setPendingDraft(draft);
  }, [draftScopeId]);

  const stage: WizardStage = preview ? "preview" : rowsMode ? "edit" : "input";

  useEffect(() => {
    if (batch || pendingDraft) return;
    if (stage === "preview") return;
    const rows = parsedRows.map(stripLocalId);
    const hasContent =
      csvText.trim().length > 0 || rows.some((r) => !isBlankRow(r)) || rowsMode;
    if (!hasContent) return;
    writeBulkPayoutDraft(draftScopeId, {
      sourceAccountId,
      csvText,
      rows,
      stage: stage === "edit" ? "edit" : "input",
    });
  }, [batch, pendingDraft, stage, sourceAccountId, csvText, parsedRows, rowsMode, draftScopeId]);

  const applyDraft = (draft: BulkPayoutDraft) => {
    const draftId = draft.sourceAccountId.trim();
    const resolvedId = sourceAccounts.some((a) => a.id === draftId)
      ? draftId
      : sourceAccounts[0]?.id || "";
    setSourceAccountId(resolvedId);
    setCsvText(draft.csvText);
    setParsedRows(withLocalIds(draft.rows.length ? draft.rows : [emptyRow()]));
    setRowsMode(draft.stage === "edit" || draft.rows.some((r) => !isBlankRow(r)));
    setPreview(null);
    setPendingDraft(null);
    setError("");
  };

  const discardDraft = () => {
    clearBulkPayoutDraft(draftScopeId);
    setPendingDraft(null);
  };

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
      'GAIZK4AKUTPECFCZVLAZ47JDBMAGFXLTA465SWE7O3GXQOZ5C5O26YAW,2,"SDP smoke · row A",EP-SDP-SMOKE-01',
      'GDYZIDXIMLWBUKSZUH42RFVGJIUDR6TXDSUTKGUWSWWVWOROPZEFQFZQ,3,"SDP smoke · row B",EP-SDP-SMOKE-02',
      'GB5W37KTU623IMKY5XQ6UDPE3JLRYL4RFESNLGMP67PG7FOAUUNPVKVF,1,"SDP smoke · row C",EP-SDP-SMOKE-03',
    ].join("\n");
    const blob = new Blob([sample + "\n"], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sdp-bulk-payout-smoke-2-3-1.csv";
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
    setPreview(null);
    clearBulkPayoutDraft(draftScopeId);
  };

  const reviewPastedCsv = () => {
    if (!csvText.trim()) return;
    loadRowsFromCsv(csvText);
  };

  const goToStep = (target: WizardStage) => {
    if (stepIndex(target) >= stepIndex(stage)) return;
    if (target === "input") {
      setPreview(null);
      setRowsMode(false);
      return;
    }
    if (target === "edit") {
      setPreview(null);
      setRowsMode(true);
    }
  };

  const persistThenCancel = () => {
    if (stage !== "preview") {
      writeBulkPayoutDraft(draftScopeId, {
        sourceAccountId,
        csvText,
        rows: parsedRows.map(stripLocalId),
        stage: stage === "edit" ? "edit" : "input",
      });
    }
    onCancel();
  };

  const previewBatch = async () => {
    const account =
      selectedAccount ||
      sourceAccounts.find((a) => a.id === sourceAccountId) ||
      sourceAccounts[0] ||
      null;
    if (!account) {
      setError("Choose the source account first.");
      return;
    }
    if (account.id !== sourceAccountId) {
      setSourceAccountId(account.id);
    }
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
        account.entityId,
        account.id,
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
    const account =
      selectedAccount ||
      sourceAccounts.find((a) => a.id === sourceAccountId) ||
      sourceAccounts[0] ||
      null;
    if (!preview?.preview_token || !account) return;
    setBusy("confirm");
    setError("");
    try {
      const nextBatch = await stellarDisbursementsApi.confirm(
        account.entityId,
        account.id,
        preview.preview_token,
      );
      clearBulkPayoutDraft(draftScopeId);
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
      <div className="ep-money-flow ep-bulk-payout">
        <div className="ep-wallets__empty">
          <div className="ep-wallets__empty-title">Stellar wallet needed</div>
          <div className="ep-wallets__empty-body">
            Open a ready Stellar stablecoin wallet before submitting a bulk payout batch.
          </div>
        </div>
        <div className="ep-money-actions ep-bulk-payout__actions">
          <button type="button" className="ep-btn-primary" onClick={onCancel}>
            Close
          </button>
        </div>
      </div>
    );
  }

  if (batch) {
    const currency = selectedAccount?.currency || "USDC";
    const statusKey = (batch.status || "").toLowerCase();
    const failedCount = batch.items.filter((i) =>
      ["failed", "error", "rejected"].includes((i.status || "").toLowerCase()),
    ).length;
    const okCount = batch.items.filter((i) =>
      ["completed", "complete", "success", "succeeded", "submitted"].includes(
        (i.status || "").toLowerCase(),
      ),
    ).length;
    const batchTone =
      statusKey.includes("partial") || (failedCount > 0 && okCount > 0)
        ? "partial"
        : failedCount > 0 || statusKey === "failed"
          ? "failed"
          : "ok";
    const title =
      batchTone === "failed"
        ? "Batch failed"
        : batchTone === "partial"
          ? "Partially sent"
          : "Submitted";
    const summary =
      batchTone === "failed"
        ? `Batch ${batch.batch_id || "—"} didn’t complete. See why each payout failed below.`
        : batchTone === "partial"
          ? `Batch ${batch.batch_id || "—"}: ${okCount} sent, ${failedCount} failed.`
          : `Batch ${batch.batch_id || "pending"} is ${batch.status}.`;

    return (
      <div className="ep-money-flow ep-bulk-payout">
        <div className={`ep-bulk-result ep-bulk-result--${batchTone}`}>
          <div className="ep-bulk-result__hero">
            <span className="ep-bulk-result__hero-icon" aria-hidden>
              {batchTone === "ok" ? "✓" : batchTone === "partial" ? "!" : "✕"}
            </span>
            <div>
              <div className="ep-bulk-result__title">{title}</div>
              <div className="ep-bulk-result__summary">{summary}</div>
            </div>
          </div>

          <ul className="ep-bulk-result__list" aria-label="Payout results">
            {batch.items.map((item, index) => {
              const itemStatus = (item.status || "").toLowerCase();
              const itemTone = ["failed", "error", "rejected"].includes(itemStatus)
                ? "failed"
                : ["completed", "complete", "success", "succeeded", "submitted"].includes(
                      itemStatus,
                    )
                  ? "ok"
                  : "pending";
              const why =
                itemTone === "failed"
                  ? explainDisbursementFailure(item.error) ||
                    (item.error
                      ? `This payout failed (${item.error.replace(/_/g, " ")}).`
                      : "This payout failed. Open the destination on Stellar Expert or retry after fixing the recipient wallet.")
                  : null;
              return (
                <li
                  key={`${item.destination}-${index}`}
                  className={`ep-bulk-result__row ep-bulk-result__row--${itemTone}`}
                >
                  <span className="ep-bulk-result__icon" aria-hidden>
                    {itemTone === "ok" ? "✓" : itemTone === "failed" ? "✕" : "…"}
                  </span>
                  <div className="ep-bulk-result__main">
                    <div className="ep-bulk-result__top">
                      <span className="ep-bulk-payout__addr" title={item.destination}>
                        {item.destination}
                      </span>
                      <span className="ep-bulk-result__meta">
                        {item.amount} {currency}
                        <span className="ep-bulk-result__badge">{item.status || "pending"}</span>
                      </span>
                    </div>
                    {why ? <p className="ep-bulk-result__why">{why}</p> : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="ep-money-actions ep-bulk-payout__actions">
          <button type="button" className="ep-btn-primary" onClick={onDone}>
            Done
          </button>
        </div>
      </div>
    );
  }

  const currency = preview?.currency || selectedAccount?.currency || "USDC";
  const totalLabel = preview?.total_amount || sumAmounts(parsedRows);
  const sourceLabel = selectedAccount ? walletLabel(selectedAccount) : "your wallet";
  const stepNum = stepIndex(stage) + 1;
  const subline =
    stage === "preview"
      ? `Step ${stepNum} · Confirm · ${totalLabel} ${currency}`
      : `Step ${stepNum} · ${STEPS[stepIndex(stage)].label}`;

  const secondaryLabel = stage === "input" ? "Cancel" : "Back";
  const primaryLabel =
    busy === "upload"
      ? "Reading CSV…"
      : busy === "preview"
        ? "Previewing…"
        : busy === "confirm"
          ? "Submitting…"
          : stage === "preview"
            ? `Confirm · ${totalLabel} ${currency}`
            : stage === "edit"
              ? "Preview batch"
              : "Review rows";

  const primaryDisabled =
    busy === "preview" ||
    busy === "confirm" ||
    busy === "upload" ||
    (stage === "input" && !csvText.trim()) ||
    (stage === "edit" && parsedRows.every(isBlankRow));

  const draftBanner = pendingDraft ? draftSummary(pendingDraft) : null;

  return (
    <div className="ep-money-flow ep-bulk-payout">
      <BulkPayoutStepper stage={stage} onStepClick={goToStep} subline={subline} />

      {draftBanner ? (
        <div className="ep-money-banner ep-bulk-payout__draft" role="status">
          <div>
            <strong>Resume draft</strong>
            <span>
              {" "}
              · {draftBanner.rows} rows · {draftBanner.total} USDC
            </span>
          </div>
          <div className="ep-bulk-payout__draft-actions">
            <button type="button" className="ep-btn-secondary" onClick={discardDraft}>
              Discard
            </button>
            <button
              type="button"
              className="ep-btn-primary"
              onClick={() => applyDraft(pendingDraft)}
            >
              Resume
            </button>
          </div>
        </div>
      ) : null}

      <div className="ep-bulk-payout__body">
        {busy === "confirm" ? (
          <div className="ep-bulk-processing" role="status" aria-live="polite">
            <SubmittingHourglass />
            <div>
              <div className="ep-bulk-processing__title">Submitting batch…</div>
              <div className="ep-bulk-processing__body">
                Sending {totalLabel} {currency} from {sourceLabel}. Keep this window open.
              </div>
            </div>
          </div>
        ) : null}

        <p className="ep-fund-chooser__intro">
          Bulk disburse on Stellar from {sourceLabel}.
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

            <div className="ep-bulk-payout__helpers">
              <button type="button" className="ep-btn-secondary" onClick={downloadSampleCsv}>
                Download sample CSV
              </button>
              <button
                type="button"
                className="ep-btn-secondary"
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
                placeholder={"destination,amount,memo,reference\nG...,2.00,Payroll,ops-001"}
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
                          disabled={busy === "preview" || busy === "confirm"}
                        />
                      </td>
                      <td>
                        <input
                          value={row.amount}
                          onChange={(event) => updateRow(index, "amount", event.target.value)}
                          placeholder="Amount"
                          inputMode="decimal"
                          aria-label={`Row ${index + 1} amount`}
                          disabled={busy === "preview" || busy === "confirm"}
                        />
                      </td>
                      <td>
                        <input
                          value={row.memo || ""}
                          onChange={(event) => updateRow(index, "memo", event.target.value)}
                          placeholder="Optional"
                          aria-label={`Row ${index + 1} memo`}
                          disabled={busy === "preview" || busy === "confirm"}
                        />
                      </td>
                      <td>
                        <input
                          value={row.reference || ""}
                          onChange={(event) => updateRow(index, "reference", event.target.value)}
                          placeholder="Optional"
                          aria-label={`Row ${index + 1} reference`}
                          disabled={busy === "preview" || busy === "confirm"}
                        />
                      </td>
                      <td>
                        <button
                          type="button"
                          className="ep-row-table__remove"
                          onClick={() => removeRow(index)}
                          aria-label={`Remove row ${index + 1}`}
                          disabled={busy === "preview" || busy === "confirm"}
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
              className="ep-btn-secondary ep-bulk-payout__add-row"
              onClick={addRow}
              disabled={busy === "preview" || busy === "confirm"}
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
            <div className="ep-money-review__row ep-money-review__row--emphasis">
              <span className="ep-money-review__k">Total</span>
              <span className="ep-money-review__v ep-money-review__v--mono">
                {totalLabel} {currency}
              </span>
            </div>
            {parsedRows.map((row) => (
              <div key={row.__id} className="ep-money-review__row">
                <span className="ep-money-review__k ep-bulk-payout__addr" title={row.destination}>
                  {row.destination}
                </span>
                <span className="ep-money-review__v">
                  {row.amount} {currency}
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
      </div>

      <footer className="ep-bulk-payout__footer">
        {stage === "preview" && busy !== "confirm" ? (
          <p className="ep-bulk-payout__caption" role="note">
            Sends {totalLabel} {currency} from {sourceLabel}.
          </p>
        ) : null}
        <div className="ep-money-actions ep-bulk-payout__actions">
          <button
            type="button"
            className="ep-btn-secondary"
            onClick={
              stage === "preview"
                ? () => setPreview(null)
                : stage === "edit"
                  ? clearRows
                  : persistThenCancel
            }
            disabled={busy === "preview" || busy === "confirm"}
          >
            {secondaryLabel}
          </button>
          <button
            type="button"
            className="ep-btn-primary"
            onClick={
              stage === "preview"
                ? () => void confirmBatch()
                : stage === "edit"
                  ? () => void previewBatch()
                  : reviewPastedCsv
            }
            disabled={primaryDisabled}
            aria-busy={busy === "preview" || busy === "confirm" || busy === "upload" || undefined}
          >
            {busy === "confirm" ? (
              <span className="ep-btn-busy">
                <SubmittingHourglass />
                Submitting…
              </span>
            ) : (
              primaryLabel
            )}
          </button>
        </div>
      </footer>
    </div>
  );
}
