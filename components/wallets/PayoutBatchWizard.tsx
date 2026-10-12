"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { ApiRequestError } from "@/lib/apiClient";
import { validateConvertAmount } from "@/lib/services/conversions";
import type { FinancialAccount } from "@/lib/services/entities";
import { formatNetworkLabel } from "@/lib/services/entities";
import { useSendCatalog } from "@/lib/hooks/useSendCatalog";
import { offRampProvidersForRail } from "@/lib/services/catalog";
import { mobileMoneyDisplayLabel } from "@/lib/services/mobileMoneyBrands";
import {
  explainPayoutFailure,
  isTransientDisbursementError,
  hasResolvableNetworkAlias,
  matchOffRampProviderForNetwork,
  newBulkPayoutIdempotencyKey,
  parseMixedPayoutCsvLoose,
  payoutBatchesApi,
  payoutMethodLabel,
  resolvePayoutRail,
  resolveRowNetworkId,
  sampleCsvFilename,
  samplePayoutCsv,
  withTransientRetry,
  type MixedPayoutBatch,
  type MixedPayoutPreview,
  type MixedPayoutRow,
  type PayoutIntent,
  type PayoutRail,
} from "@/lib/services/payoutBatches";
import { stellarExplorerTxUrl } from "@/lib/stellar/network";

type EditableRow = MixedPayoutRow & { __id: number };
type WizardStage = "intent" | "input" | "edit" | "preview";

type Props = {
  sourceAccounts: FinancialAccount[];
  onDone: () => void;
  onCancel: () => void;
};

const STEPS = [
  { id: "intent" as const, label: "Choose" },
  { id: "input" as const, label: "Recipients" },
  { id: "edit" as const, label: "Review rows" },
  { id: "preview" as const, label: "Send" },
];

const INTENT_OPTIONS: {
  id: PayoutIntent;
  title: string;
  body: string;
}[] = [
  {
    id: "wallets",
    title: "Stellar wallets only",
    body: "Pay 100+ user wallets on-chain instantly. Everyone gets USDC on Stellar.",
  },
  {
    id: "wallets_and_phones",
    title: "Wallets, phones, and banks",
    body: "Pay across KE, NG, GH, UG, and TZ — wallet, mobile money, or bank. One way per person.",
  },
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
    network: "",
    network_id: "",
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
    row.network?.trim() ||
    row.amount?.trim() ||
    row.recipient_name?.trim() ||
    row.memo?.trim() ||
    row.reference?.trim() ||
    (row.country || "").trim()
  );
}

function stepIndex(stage: WizardStage): number {
  return STEPS.findIndex((s) => s.id === stage);
}

function sumUsdcAmounts(rows: MixedPayoutRow[]): string {
  const total = rows.reduce((sum, row) => {
    if ((row.currency || "").toUpperCase() !== "USDC") return sum;
    return sum + Number(row.amount || 0);
  }, 0);
  return total.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function RailBadge({
  rail,
  network,
}: {
  rail: PayoutRail | null;
  network?: string | null;
}) {
  const tone =
    rail === "stellar"
      ? "stellar"
      : rail === "mobile_money"
        ? "momo"
        : rail === "bank"
          ? "bank"
          : "none";
  return (
    <span className={`ep-rail-badge ep-rail-badge--${tone}`}>
      {payoutMethodLabel(rail, network)}
    </span>
  );
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
      <ol className="ep-bulk-stepper__list" aria-label="Pay many people steps">
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

function failureWhy(code: string | null | undefined, rail: PayoutRail): string {
  return (
    explainPayoutFailure(code, rail) ||
    (code
      ? `This payout failed (${code.replace(/_/g, " ")}).`
      : "This payout failed. Check the recipient details and try again.")
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
        : statusKey === "processing"
          ? "Processing"
          : "Submitted";
  const summary =
    batchTone === "failed"
      ? `Batch ${batch.batch_id || "—"} didn’t complete. Tap Why on a row for details.`
      : batchTone === "partial"
        ? `Batch ${batch.batch_id || "—"}: ${okCount} sent, ${failedCount} failed.`
        : statusKey === "processing"
          ? `Batch ${batch.batch_id || "pending"} is sending. Status updates as each person is paid · ${batch.stellar_item_count} wallet · ${batch.fiat_item_count} mobile money.`
          : `Batch ${batch.batch_id || "pending"} · ${batch.stellar_item_count} wallet · ${batch.fiat_item_count} mobile money.`;

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
          {batch.items.map((item) => {
            const itemStatus = (item.status || "").toLowerCase();
            const itemTone = ["failed", "error", "rejected"].includes(itemStatus)
              ? "failed"
              : ["completed", "complete", "success", "succeeded", "submitted"].includes(
                    itemStatus,
                  )
                ? "ok"
                : "pending";
            const rowKey = `${item.row_index}-${item.recipient_label}`;
            const open = openKey === rowKey;
            const explorerUrl =
              item.rail === "stellar" && itemTone === "ok"
                ? stellarExplorerTxUrl({
                    txHash: item.tx_hash,
                    network: network || "Stellar",
                  })
                : null;
            return (
              <li
                key={rowKey}
                className={`ep-bulk-result__row ep-bulk-result__row--${itemTone}`}
              >
                <span className="ep-bulk-result__icon" aria-hidden>
                  {itemTone === "ok" ? "✓" : itemTone === "failed" ? "✕" : "…"}
                </span>
                <div className="ep-bulk-result__main">
                  <div className="ep-bulk-result__top">
                    <span className="ep-bulk-payout__addr" title={item.recipient_label}>
                      {item.recipient_label}
                    </span>
                    <span className="ep-bulk-result__meta">
                      <RailBadge rail={item.rail} network={item.network} />
                      <span className="ep-bulk-result__amount">
                        {item.amount} {item.currency}
                      </span>
                      <span className="ep-bulk-result__badge">{item.status || "pending"}</span>
                      {itemTone === "failed" ? (
                        <button
                          type="button"
                          className="ep-bulk-result__why-btn"
                          aria-expanded={open}
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
                    <div
                      className="ep-bulk-result__why-panel"
                      role="region"
                      aria-label="Failure reason"
                    >
                      {failureWhy(item.failure_code || item.last_error, item.rail)}
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
      {refreshError ? (
        <div className="ep-money-banner ep-money-banner--danger" role="alert">
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
  const [intent, setIntent] = useState<PayoutIntent | null>(null);
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
  const showPhoneCols = intent === "wallets_and_phones";
  const catalogQuery = useSendCatalog({ enabled: showPhoneCols });
  const catalog = catalogQuery.data ?? null;

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

  const stage: WizardStage = !intent
    ? "intent"
    : preview
      ? "preview"
      : rowsMode
        ? "edit"
        : "input";

  const chooseIntent = (next: PayoutIntent) => {
    setIntent(next);
    setError("");
    setCsvText("");
    setParsedRows([]);
    setRowsMode(false);
    setPreview(null);
  };

  const loadRowsFromCsv = (text: string) => {
    try {
      const rows = parseMixedPayoutCsvLoose(text);
      if (intent === "wallets") {
        for (let i = 0; i < rows.length; i += 1) {
          if (rows[i].phone?.trim() || rows[i].bank_account_number?.trim()) {
            setError(
              `Row ${i + 1}: this path is wallets only — remove phone/bank fields or choose “Wallets, phones, and banks”.`,
            );
            return;
          }
        }
      }
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
    if (!intent) return;
    const blob = new Blob([samplePayoutCsv(intent) + "\n"], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = sampleCsvFilename(intent);
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
  };

  const updateRow = (index: number, field: keyof MixedPayoutRow, value: string) => {
    setParsedRows((rows) =>
      rows.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
    );
  };

  const updateRowFields = (index: number, patch: Partial<MixedPayoutRow>) => {
    setParsedRows((rows) =>
      rows.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
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
  };

  const goToStep = (target: WizardStage) => {
    if (stepIndex(target) >= stepIndex(stage)) return;
    if (target === "intent") {
      setIntent(null);
      setPreview(null);
      setRowsMode(false);
      setParsedRows([]);
      setCsvText("");
      return;
    }
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

  const rowRailIssues = useMemo(
    () =>
      parsedRows.map((row) => {
        if (isBlankRow(row)) return null;
        if (intent === "wallets" && (row.phone?.trim() || row.bank_account_number?.trim())) {
          return "Wallets-only path — use a wallet address, not a phone.";
        }
        const resolution = resolvePayoutRail(row);
        if (resolution.error) return resolution.error;
        if (resolution.rail === "mobile_money" || resolution.rail === "bank") {
          // Alias present → OK for review; Mboka resolves network_id at preview.
          if (hasResolvableNetworkAlias(resolution.rail, row)) return null;
          // Only nudge when the catalog clearly lists providers and the cell is empty.
          if (!catalogQuery.isFetched) return null;
          const railType = resolution.rail === "bank" ? "bank" : "mobile";
          const providers =
            offRampProvidersForRail(
              catalog,
              (row.country || "").trim(),
              railType,
              row.currency,
            ) || [];
          if (providers.length === 0) return null;
          return resolution.rail === "bank"
            ? "Choose a bank for this country."
            : "Choose a mobile money network for this country.";
        }
        return null;
      }),
    [parsedRows, intent, catalog, catalogQuery.isFetched],
  );

  const previewBlocked = rowRailIssues.some(Boolean);

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
    if (account.id !== sourceAccountId) setSourceAccountId(account.id);

    const rows: MixedPayoutRow[] = [];
    for (let i = 0; i < parsedRows.length; i += 1) {
      const row = parsedRows[i];
      if (isBlankRow(row)) continue;
      const resolution = resolvePayoutRail(row);
      if (resolution.error || !resolution.rail) {
        setError(`Row ${i + 1}: ${resolution.error || "unresolved rail."}`);
        return;
      }
      if (intent === "wallets" && resolution.rail !== "stellar") {
        setError(`Row ${i + 1}: wallets-only path — use a Stellar wallet address.`);
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
      const outbound = stripLocalId(row);
      if (resolution.rail === "mobile_money" || resolution.rail === "bank") {
        if (!hasResolvableNetworkAlias(resolution.rail, outbound)) {
          setError(
            resolution.rail === "bank"
              ? `Row ${i + 1}: add a bank name in Network (e.g. Equity Bank).`
              : `Row ${i + 1}: add a network (e.g. mpesa or airtel).`,
          );
          return;
        }
        const railType = resolution.rail === "bank" ? "bank" : "mobile";
        const matched = matchOffRampProviderForNetwork(
          catalog,
          outbound.country,
          outbound.network || outbound.bank_code,
          railType,
          outbound.currency,
        );
        const networkId = resolveRowNetworkId(catalog, outbound, resolution.rail);
        // Prefer a local catalog UUID when available; otherwise Mboka resolves the alias.
        if (networkId) outbound.network_id = networkId;
        if (matched?.name) outbound.network = matched.name;
        else if (!(outbound.network || "").trim() && (outbound.bank_code || "").trim()) {
          outbound.network = outbound.bank_code;
        }
        // Older Mboka builds required bank_code — mirror network into it for bank rows.
        if (
          resolution.rail === "bank" &&
          !(outbound.bank_code || "").trim() &&
          (outbound.network || "").trim()
        ) {
          outbound.bank_code = outbound.network;
        }
      } else {
        outbound.network = null;
        outbound.network_id = null;
      }
      rows.push(outbound);
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
      const nextPreview = await withTransientRetry(() =>
        payoutBatchesApi.preview(account.entityId, account.id, rows, {
          idempotencyKey: idempotencyKeyRef.current || undefined,
        }),
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
    setSafeConfirmRetry(false);
    try {
      const nextBatch = await withTransientRetry(() =>
        payoutBatchesApi.confirm(account.entityId, account.id, preview.preview_token),
      );
      idempotencyKeyRef.current = null;
      setBatch(nextBatch);
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
          <div className="ep-wallets__empty-title">USDC wallet needed</div>
          <div className="ep-wallets__empty-body">
            Open a ready USDC (Stellar) balance before you pay many people.
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

  const sourceLabel = selectedAccount ? walletLabel(selectedAccount) : "your USDC balance";
  const usdcTotal = sumUsdcAmounts(parsedRows);
  const stepNum = stepIndex(stage) + 1;
  const subline =
    stage === "intent"
      ? "Step 1 · Choose how you’re making this payout"
      : stage === "preview" && preview
        ? `Step ${stepNum} · Send · ${preview.total_items} people · ${preview.stellar_item_count} wallet · ${preview.fiat_item_count} mobile money`
        : stage === "edit"
          ? `Step ${stepNum} · Review rows · ${parsedRows.filter((r) => !isBlankRow(r)).length} people`
          : `Step ${stepNum} · ${STEPS[stepIndex(stage)].label}`;

  const secondaryLabel =
    stage === "intent" ? "Cancel" : stage === "input" ? "Back" : "Back";
  const primaryLabel =
    busy === "upload"
      ? "Reading CSV…"
      : busy === "preview"
        ? "Previewing…"
        : busy === "confirm"
          ? "Sending…"
          : stage === "preview"
            ? safeConfirmRetry
              ? "Retry send"
              : "Send payout"
            : stage === "edit"
              ? "Review payout"
              : stage === "intent"
                ? "Continue"
                : "Review rows";

  const primaryDisabled =
    busy === "preview" ||
    busy === "confirm" ||
    busy === "upload" ||
    stage === "intent" ||
    (stage === "input" && !csvText.trim()) ||
    (stage === "edit" && (parsedRows.every(isBlankRow) || previewBlocked));

  const pastePlaceholder =
    intent === "wallets"
      ? "destination,amount,currency,recipient_name,memo,reference\nG…,5.00,USDC,Alex,,ref-1"
      : "destination,phone,bank_account_number,country,network,amount,currency,recipient_name,memo,reference\nG…,,,,,5.00,USDC,Alex,,ref-1\n,+2541111111111,,KE,mpesa,1500,KES,Jane,,ref-2\n,,1111111111,KE,Equity Bank,2200,KES,Grace,,ref-3";

  return (
    <div className="ep-money-flow ep-bulk-payout">
      <BulkPayoutStepper stage={stage} onStepClick={goToStep} subline={subline} />

      <div className="ep-bulk-payout__body">
        {busy === "confirm" ? (
          <div className="ep-bulk-processing" role="status" aria-live="polite">
            <SubmittingHourglass />
            <div>
              <div className="ep-bulk-processing__title">Sending payout…</div>
              <div className="ep-bulk-processing__body">
                Paying from {sourceLabel}. Keep this window open.
              </div>
            </div>
          </div>
        ) : null}

        {stage === "intent" ? (
          <>
            <p className="ep-fund-chooser__intro">
              Pay many people from your USDC balance. Pick the list type that matches your
              recipients.
            </p>
            <div className="ep-bulk-intent" role="listbox" aria-label="Payout type">
              {INTENT_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  role="option"
                  className="ep-fund-chooser__option"
                  onClick={() => chooseIntent(option.id)}
                >
                  <span className="ep-fund-chooser__option-title">{option.title}</span>
                  <span className="ep-fund-chooser__option-body">{option.body}</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <p className="ep-fund-chooser__intro">
              {intent === "wallets"
                ? `Pay to Stellar wallets from ${sourceLabel}.`
                : `Pay to wallets, phones, or banks from ${sourceLabel}. One way per person.`}
            </p>
            {stage === "input" ? (
              <p className="ep-muted" role="note">
                {intent === "wallets"
                  ? "Each row needs a wallet address (destination) and amount."
                  : "Each row: wallet, phone, or bank (+ country, network, name). First batch: KE, NG, GH, UG, TZ."}
              </p>
            ) : null}

            <label className="ep-field">
              <span>Pay from</span>
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
          </>
        )}

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
              <span className="ep-dropzone__hint">
                {intent === "wallets"
                  ? "Sample has wallet addresses only"
                  : "Sample uses YC sandbox numbers only (…1111111111 success / …0000000000 fail) — real phones can pend"}
              </span>
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
                placeholder={pastePlaceholder}
                rows={8}
                disabled={busy === "upload"}
              />
            </label>
          </>
        ) : stage === "edit" ? (
          <>
            <p className="ep-muted ep-row-table-scroll-hint" role="note">
              Wide table — scroll sideways to see name and reference.
            </p>
            <div className="ep-row-table-wrap ep-row-table-wrap--mixed">
              <table className="ep-row-table ep-row-table--mixed" aria-label="Payout rows">
                <thead>
                  <tr>
                    <th>How</th>
                    <th>Wallet</th>
                    {showPhoneCols ? <th>Phone</th> : null}
                    {showPhoneCols ? <th>Bank acct</th> : null}
                    {showPhoneCols ? <th>Country</th> : null}
                    {showPhoneCols ? <th>Network</th> : null}
                    <th>Amount</th>
                    <th>Currency</th>
                    <th>Name</th>
                    <th>Reference</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {parsedRows.map((row, index) => {
                    const resolution = isBlankRow(row) ? null : resolvePayoutRail(row);
                    const networkRailType =
                      resolution?.rail === "bank"
                        ? "bank"
                        : resolution?.rail === "mobile_money" || (row.phone || "").trim()
                          ? "mobile"
                          : (row.bank_account_number || "").trim()
                            ? "bank"
                            : "mobile";
                    const networkProviders =
                      showPhoneCols && (row.country || "").trim()
                        ? offRampProvidersForRail(
                            catalog,
                            (row.country || "").trim(),
                            networkRailType,
                            row.currency,
                          ) || []
                        : [];
                    const networkValue = (row.network || row.bank_code || "").trim();
                    const networkInList = networkProviders.some(
                      (p) =>
                        p.name === networkValue ||
                        p.code === networkValue ||
                        (p.id || "") === networkValue,
                    );
                    const networkSelectEnabled =
                      Boolean((row.phone || "").trim()) ||
                      Boolean((row.bank_account_number || "").trim());
                    return (
                      <tr key={row.__id}>
                        <td>
                          <RailBadge
                            rail={resolution?.rail ?? null}
                            network={row.network || row.bank_code}
                          />
                          {rowRailIssues[index] ? (
                            <div className="ep-rail-badge__error">{rowRailIssues[index]}</div>
                          ) : null}
                        </td>
                        <td>
                          <input
                            value={row.destination || ""}
                            onChange={(event) =>
                              updateRow(index, "destination", event.target.value)
                            }
                            placeholder=""
                            aria-label={`Row ${index + 1} wallet`}
                            disabled={busy === "preview" || busy === "confirm"}
                          />
                        </td>
                        {showPhoneCols ? (
                          <td>
                            <input
                              value={row.phone || ""}
                              onChange={(event) => updateRow(index, "phone", event.target.value)}
                              placeholder=""
                              aria-label={`Row ${index + 1} phone`}
                              disabled={busy === "preview" || busy === "confirm"}
                            />
                          </td>
                        ) : null}
                        {showPhoneCols ? (
                          <td>
                            <input
                              value={row.bank_account_number || ""}
                              onChange={(event) =>
                                updateRow(index, "bank_account_number", event.target.value)
                              }
                              placeholder=""
                              aria-label={`Row ${index + 1} bank account`}
                              disabled={busy === "preview" || busy === "confirm"}
                            />
                          </td>
                        ) : null}
                        {showPhoneCols ? (
                          <td>
                            <input
                              value={row.country || ""}
                              onChange={(event) =>
                                updateRow(index, "country", event.target.value)
                              }
                              placeholder=""
                              aria-label={`Row ${index + 1} country`}
                              disabled={busy === "preview" || busy === "confirm"}
                            />
                          </td>
                        ) : null}
                        {showPhoneCols ? (
                          <td>
                            <select
                              value={
                                networkInList
                                  ? networkProviders.find(
                                      (p) =>
                                        p.name === networkValue ||
                                        p.code === networkValue ||
                                        (p.id || "") === networkValue,
                                    )?.name || ""
                                  : networkValue
                                    ? `__custom__:${networkValue}`
                                    : ""
                              }
                              onChange={(event) => {
                                const value = event.target.value;
                                if (value.startsWith("__custom__:")) {
                                  updateRowFields(index, {
                                    network: value.slice("__custom__:".length),
                                    network_id: "",
                                  });
                                  return;
                                }
                                if (!value) {
                                  updateRowFields(index, { network: "", network_id: "" });
                                  return;
                                }
                                const provider = networkProviders.find((p) => p.name === value);
                                updateRowFields(index, {
                                  network: provider?.name || value,
                                  network_id: provider?.id || "",
                                });
                              }}
                              aria-label={`Row ${index + 1} network`}
                              disabled={
                                busy === "preview" ||
                                busy === "confirm" ||
                                !networkSelectEnabled
                              }
                            >
                              <option value="">Select network</option>
                              {networkValue && !networkInList ? (
                                <option value={`__custom__:${networkValue}`}>
                                  {networkRailType === "mobile"
                                    ? mobileMoneyDisplayLabel(networkValue)
                                    : networkValue}
                                </option>
                              ) : null}
                              {networkProviders.map((provider) => (
                                <option key={provider.id || provider.code} value={provider.name}>
                                  {networkRailType === "mobile"
                                    ? mobileMoneyDisplayLabel(provider.name)
                                    : provider.name}
                                </option>
                              ))}
                            </select>
                          </td>
                        ) : null}
                        <td>
                          <input
                            value={row.amount}
                            onChange={(event) => updateRow(index, "amount", event.target.value)}
                            placeholder=""
                            inputMode="decimal"
                            aria-label={`Row ${index + 1} amount`}
                            disabled={busy === "preview" || busy === "confirm"}
                          />
                        </td>
                        <td>
                          <input
                            value={row.currency}
                            onChange={(event) => updateRow(index, "currency", event.target.value)}
                            placeholder=""
                            aria-label={`Row ${index + 1} currency`}
                            disabled={busy === "preview" || busy === "confirm"}
                          />
                        </td>
                        <td>
                          <input
                            value={row.recipient_name || ""}
                            onChange={(event) =>
                              updateRow(index, "recipient_name", event.target.value)
                            }
                            placeholder=""
                            aria-label={`Row ${index + 1} name`}
                            disabled={busy === "preview" || busy === "confirm"}
                          />
                        </td>
                        <td>
                          <input
                            value={row.reference || ""}
                            onChange={(event) =>
                              updateRow(index, "reference", event.target.value)
                            }
                            placeholder=""
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
                    );
                  })}
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
        ) : preview ? (
          <div className="ep-money-review" role="group" aria-label="Bulk payout preview">
            <div className="ep-money-review__row">
              <span className="ep-money-review__k">People</span>
              <span className="ep-money-review__v">{preview.total_items}</span>
            </div>
            <div className="ep-money-review__row">
              <span className="ep-money-review__k">How they get paid</span>
              <span className="ep-money-review__v">
                {preview.stellar_item_count} wallet · {preview.fiat_item_count} mobile money
              </span>
            </div>
            {preview.items.map((item) => (
              <div key={item.row_index} className="ep-money-review__row">
                <span
                  className="ep-money-review__k ep-bulk-payout__addr"
                  title={item.recipient_label}
                >
                  {item.recipient_label}
                </span>
                <span className="ep-money-review__v">
                  <RailBadge rail={item.rail} network={item.network} /> {item.amount}{" "}
                  {item.currency}
                </span>
              </div>
            ))}
          </div>
        ) : null}

        {error ? (
          <div className="ep-money-banner ep-money-banner--danger" role="alert">
            <span>{error}</span>
            {safeConfirmRetry && stage === "preview" ? (
              <button
                type="button"
                className="ep-bulk-payout__retry"
                onClick={() => void confirmBatch()}
                disabled={busy === "confirm"}
              >
                Retry
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      <footer className="ep-bulk-payout__footer">
        {stage === "preview" && busy !== "confirm" ? (
          <p className="ep-bulk-payout__caption" role="note">
            Sends from {sourceLabel}
            {usdcTotal !== "0.00" ? ` · ~${usdcTotal} USDC in wallet rows` : ""}. Status keeps
            updating after you send.
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
                  : stage === "input"
                    ? () => goToStep("intent")
                    : onCancel
            }
            disabled={busy === "preview" || busy === "confirm"}
          >
            {secondaryLabel}
          </button>
          {stage === "intent" ? null : (
            <button
              type="button"
              className="ep-btn-primary"
              onClick={
                stage === "preview"
                  ? () => void confirmBatch()
                  : stage === "edit"
                    ? () => void previewBatch()
                    : () => loadRowsFromCsv(csvText)
              }
              disabled={primaryDisabled}
              aria-busy={busy === "preview" || busy === "confirm" || busy === "upload" || undefined}
            >
              {busy === "confirm" ? (
                <span className="ep-btn-busy">
                  <SubmittingHourglass />
                  Sending…
                </span>
              ) : (
                primaryLabel
              )}
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}
