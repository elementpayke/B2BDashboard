"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ApiRequestError } from "@/lib/apiClient";
import { MIXED_RAIL_BULK_PAYOUTS_ENABLED } from "@/lib/config/stellarFeatures";
import type { FinancialAccount } from "@/lib/services/entities";
import { formatNetworkLabel } from "@/lib/services/entities";
import { describeDisbursementStatus } from "@/lib/services/disbursementStatus";
import {
  explainPayoutFailure,
  payoutBatchesApi,
  railLabel,
  withTransientRetry,
  type MixedPayoutBatch,
  type PayoutRail,
} from "@/lib/services/payoutBatches";
import {
  explainDisbursementFailure,
  stellarDisbursementsApi,
  type BulkStellarPayoutBatch,
  type DisbursementReconciliationReport,
} from "@/lib/services/stellarDisbursements";
import { stellarExplorerTxUrl } from "@/lib/stellar/network";
import StatusBadge from "@/components/ui/StatusBadge";

type Props = {
  sourceAccounts: FinancialAccount[];
  onDone: () => void;
};

function walletLabel(account: FinancialAccount): string {
  return `${account.currency} · ${formatNetworkLabel(account.network)} · ${account.id}`;
}

function itemTone(status: string | null | undefined): "ok" | "failed" | "pending" {
  const key = (status || "").toLowerCase();
  if (["failed", "error", "rejected"].includes(key)) return "failed";
  if (["completed", "complete", "success", "succeeded"].includes(key)) return "ok";
  return "pending";
}

function RailBadge({ rail }: { rail: PayoutRail }) {
  const tone =
    rail === "stellar" ? "stellar" : rail === "mobile_money" ? "momo" : rail === "bank" ? "bank" : "none";
  return <span className={`ep-rail-badge ep-rail-badge--${tone}`}>{railLabel(rail)}</span>;
}

function MixedRailHistory({ sourceAccounts, onDone }: Props) {
  const [sourceAccountId, setSourceAccountId] = useState(sourceAccounts[0]?.id || "");
  const selectedAccount = useMemo(
    () => sourceAccounts.find((account) => account.id === sourceAccountId) || null,
    [sourceAccountId, sourceAccounts],
  );

  const [batches, setBatches] = useState<MixedPayoutBatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [openBatchId, setOpenBatchId] = useState<string | null>(null);
  const [itemsLoadingId, setItemsLoadingId] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const [openWhyKey, setOpenWhyKey] = useState<string | null>(null);

  useEffect(() => {
    if (!sourceAccounts.length) return;
    const stillValid = sourceAccounts.some((account) => account.id === sourceAccountId);
    if (!stillValid) setSourceAccountId(sourceAccounts[0].id);
  }, [sourceAccounts, sourceAccountId]);

  const loadBatches = async () => {
    if (!selectedAccount) return;
    setLoading(true);
    setLoadError("");
    try {
      const rows = await withTransientRetry(() =>
        payoutBatchesApi.listBatches(selectedAccount.entityId, selectedAccount.id),
      );
      setBatches(rows);
    } catch (err) {
      setLoadError(
        err instanceof ApiRequestError || err instanceof Error
          ? err.message
          : "Couldn't load payout batches.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadBatches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAccount?.id]);

  useEffect(() => {
    if (!openBatchId || !selectedAccount) return;
    const current = batches.find((b) => b.batch_id === openBatchId);
    if (!current || current.items.length > 0) return;
    let cancelled = false;
    setItemsLoadingId(openBatchId);
    payoutBatchesApi
      .getBatch(selectedAccount.entityId, selectedAccount.id, openBatchId)
      .then((full) => {
        if (cancelled) return;
        setBatches((prev) =>
          prev.map((b) => (b.batch_id === openBatchId ? { ...b, ...full } : b)),
        );
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setItemsLoadingId(null);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openBatchId, selectedAccount?.id]);

  const runSync = async (batchId: string) => {
    if (!selectedAccount || actionBusy) return;
    setActionBusy(`sync:${batchId}`);
    setActionError("");
    try {
      const next = await payoutBatchesApi.syncBatch(
        selectedAccount.entityId,
        selectedAccount.id,
        batchId,
      );
      setBatches((prev) => prev.map((b) => (b.batch_id === batchId ? next : b)));
    } catch (err) {
      setActionError(
        err instanceof ApiRequestError || err instanceof Error
          ? err.message
          : "Couldn't sync batch status.",
      );
    } finally {
      setActionBusy(null);
    }
  };

  return (
    <div className="ep-money-flow ep-bulk-payout">
      <p className="ep-fund-chooser__intro">
        Mixed-rail payout batches for this wallet — Stellar and mobile money in one place.
      </p>

      {sourceAccounts.length > 1 ? (
        <label className="ep-field">
          <span>Wallet</span>
          <select value={sourceAccountId} onChange={(e) => setSourceAccountId(e.target.value)}>
            {sourceAccounts.map((account) => (
              <option key={account.id} value={account.id}>
                {walletLabel(account)}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {loadError ? (
        <div className="ep-money-banner ep-money-banner--danger" role="alert">
          {loadError}
        </div>
      ) : null}
      {actionError ? (
        <div className="ep-money-banner ep-money-banner--danger" role="alert">
          {actionError}
        </div>
      ) : null}

      {loading ? (
        <p className="ep-muted">Loading batches…</p>
      ) : batches.length === 0 ? (
        <p className="ep-muted">No payout batches yet for this wallet.</p>
      ) : (
        <ul className="ep-bulk-result__list" aria-label="Payout batches">
          {batches.map((batch) => {
            const descriptor = describeDisbursementStatus(batch.status);
            const open = openBatchId === batch.batch_id;
            const showRefresh = batch.stellar_item_count > 0;
            return (
              <li key={batch.batch_id} className="ep-bulk-result__row ep-bulk-result__row--pending">
                <div className="ep-bulk-result__main" style={{ width: "100%" }}>
                  <div className="ep-bulk-result__top">
                    <button
                      type="button"
                      className="ep-bulk-result__why-btn"
                      aria-expanded={open}
                      onClick={() => setOpenBatchId(open ? null : batch.batch_id)}
                      style={{ fontWeight: 600 }}
                    >
                      Batch {batch.batch_id} {open ? "▲" : "▼"}
                    </button>
                    <span className="ep-bulk-result__meta">
                      <span className="ep-bulk-result__amount">
                        {batch.total_items} items · {batch.stellar_item_count} Stellar ·{" "}
                        {batch.fiat_item_count} fiat
                      </span>
                      <StatusBadge
                        label={descriptor.label}
                        color={descriptor.color}
                        soft={descriptor.soft}
                        icon={descriptor.icon}
                      />
                    </span>
                  </div>

                  {open ? (
                    <div className="ep-bulk-result__why-panel" role="region" aria-label="Batch detail">
                      {showRefresh ? (
                        <div className="ep-money-actions" style={{ marginBottom: 12 }}>
                          <button
                            type="button"
                            className="ep-btn-secondary"
                            disabled={actionBusy !== null}
                            onClick={() => void runSync(batch.batch_id)}
                          >
                            {actionBusy === `sync:${batch.batch_id}`
                              ? "Refreshing…"
                              : "Refresh status"}
                          </button>
                        </div>
                      ) : null}

                      {itemsLoadingId === batch.batch_id ? (
                        <p className="ep-muted">Loading items…</p>
                      ) : !batch.items.length ? (
                        <p className="ep-muted">No item detail available for this batch.</p>
                      ) : null}

                      <ul className="ep-bulk-result__list" aria-label="Batch items">
                        {batch.items.map((item) => {
                          const tone = itemTone(item.status);
                          const rowKey = `${batch.batch_id}-${item.row_index}`;
                          const whyOpen = openWhyKey === rowKey;
                          const explorerUrl =
                            item.rail === "stellar" && tone === "ok"
                              ? stellarExplorerTxUrl({
                                  txHash: item.tx_hash,
                                  network: "Stellar",
                                })
                              : null;
                          return (
                            <li
                              key={rowKey}
                              className={`ep-bulk-result__row ep-bulk-result__row--${tone}`}
                            >
                              <span className="ep-bulk-result__icon" aria-hidden>
                                {tone === "ok" ? "✓" : tone === "failed" ? "✕" : "…"}
                              </span>
                              <div className="ep-bulk-result__main">
                                <div className="ep-bulk-result__top">
                                  <span
                                    className="ep-bulk-payout__addr"
                                    title={item.recipient_label}
                                  >
                                    {item.recipient_label}
                                  </span>
                                  <span className="ep-bulk-result__meta">
                                    <RailBadge rail={item.rail} />
                                    <span className="ep-bulk-result__amount">
                                      {item.amount} {item.currency}
                                    </span>
                                    <span className="ep-bulk-result__badge">
                                      {item.status || "pending"}
                                    </span>
                                    {tone === "failed" ? (
                                      <button
                                        type="button"
                                        className="ep-bulk-result__why-btn"
                                        aria-expanded={whyOpen}
                                        onClick={() => setOpenWhyKey(whyOpen ? null : rowKey)}
                                      >
                                        {whyOpen ? "Hide" : "Why?"}
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
                                {whyOpen ? (
                                  <div
                                    className="ep-bulk-result__why-panel"
                                    role="region"
                                    aria-label="Failure reason"
                                  >
                                    {explainPayoutFailure(
                                      item.failure_code || item.last_error,
                                      item.rail,
                                    ) ||
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
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="ep-money-actions">
        <button type="button" className="ep-btn-primary" onClick={onDone}>
          Done
        </button>
        <button
          type="button"
          className="ep-btn-secondary"
          onClick={() => void loadBatches()}
          disabled={loading}
        >
          {loading ? "Refreshing…" : "Refresh list"}
        </button>
      </div>
    </div>
  );
}

function StellarOnlyHistory({ sourceAccounts, onDone }: Props) {
  const [sourceAccountId, setSourceAccountId] = useState(sourceAccounts[0]?.id || "");
  const selectedAccount = useMemo(
    () => sourceAccounts.find((account) => account.id === sourceAccountId) || null,
    [sourceAccountId, sourceAccounts],
  );

  const [batches, setBatches] = useState<BulkStellarPayoutBatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [openBatchId, setOpenBatchId] = useState<string | null>(null);
  const [itemsLoadingId, setItemsLoadingId] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const [reconciliation, setReconciliation] = useState<
    Record<string, DisbursementReconciliationReport>
  >({});
  const [openWhyKey, setOpenWhyKey] = useState<string | null>(null);

  useEffect(() => {
    if (!sourceAccounts.length) return;
    const stillValid = sourceAccounts.some((account) => account.id === sourceAccountId);
    if (!stillValid) setSourceAccountId(sourceAccounts[0].id);
  }, [sourceAccounts, sourceAccountId]);

  const loadBatches = async () => {
    if (!selectedAccount) return;
    setLoading(true);
    setLoadError("");
    try {
      const rows = await withTransientRetry(() =>
        stellarDisbursementsApi.listBatches(selectedAccount.entityId, selectedAccount.id),
      );
      setBatches(rows);
    } catch (err) {
      setLoadError(
        err instanceof ApiRequestError || err instanceof Error
          ? err.message
          : "Couldn't load disbursement batches.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadBatches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAccount?.id]);

  useEffect(() => {
    if (!openBatchId || !selectedAccount) return;
    const current = batches.find((b) => b.batch_id === openBatchId);
    if (!current || current.items.length > 0) return;
    let cancelled = false;
    setItemsLoadingId(openBatchId);
    stellarDisbursementsApi
      .getBatch(selectedAccount.entityId, selectedAccount.id, openBatchId)
      .then((full) => {
        if (cancelled) return;
        setBatches((prev) =>
          prev.map((b) => (b.batch_id === openBatchId ? { ...b, ...full } : b)),
        );
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setItemsLoadingId(null);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openBatchId, selectedAccount?.id]);

  const runSync = async (batchId: string) => {
    if (!selectedAccount || actionBusy) return;
    setActionBusy(`sync:${batchId}`);
    setActionError("");
    try {
      const next = await stellarDisbursementsApi.syncBatch(
        selectedAccount.entityId,
        selectedAccount.id,
        batchId,
      );
      setBatches((prev) => prev.map((b) => (b.batch_id === batchId ? next : b)));
    } catch (err) {
      setActionError(
        err instanceof ApiRequestError || err instanceof Error
          ? err.message
          : "Couldn't sync batch status.",
      );
    } finally {
      setActionBusy(null);
    }
  };

  const runReconcile = async (batchId: string) => {
    if (!selectedAccount || actionBusy) return;
    setActionBusy(`reconcile:${batchId}`);
    setActionError("");
    try {
      const result = await stellarDisbursementsApi.reconcileBatch(
        selectedAccount.entityId,
        selectedAccount.id,
        batchId,
      );
      setBatches((prev) => prev.map((b) => (b.batch_id === batchId ? result.batch : b)));
      setReconciliation((prev) => ({ ...prev, [batchId]: result.reconciliation }));
    } catch (err) {
      setActionError(
        err instanceof ApiRequestError || err instanceof Error
          ? err.message
          : "Couldn't reconcile batch.",
      );
    } finally {
      setActionBusy(null);
    }
  };

  return (
    <div className="ep-money-flow ep-bulk-payout">
      <p className="ep-fund-chooser__intro">
        Every bulk payout batch for this wallet, synced and reconciled against Stellar directly.
      </p>

      {sourceAccounts.length > 1 ? (
        <label className="ep-field">
          <span>Wallet</span>
          <select value={sourceAccountId} onChange={(e) => setSourceAccountId(e.target.value)}>
            {sourceAccounts.map((account) => (
              <option key={account.id} value={account.id}>
                {walletLabel(account)}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {loadError ? (
        <div className="ep-money-banner ep-money-banner--danger" role="alert">
          {loadError}
        </div>
      ) : null}
      {actionError ? (
        <div className="ep-money-banner ep-money-banner--danger" role="alert">
          {actionError}
        </div>
      ) : null}

      {loading ? (
        <p className="ep-muted">Loading batches…</p>
      ) : batches.length === 0 ? (
        <p className="ep-muted">No disbursement batches yet for this wallet.</p>
      ) : (
        <ul className="ep-bulk-result__list" aria-label="Disbursement batches">
          {batches.map((batch) => {
            const descriptor = describeDisbursementStatus(batch.status);
            const open = openBatchId === batch.batch_id;
            const report = reconciliation[batch.batch_id];
            return (
              <li key={batch.batch_id} className="ep-bulk-result__row ep-bulk-result__row--pending">
                <div className="ep-bulk-result__main" style={{ width: "100%" }}>
                  <div className="ep-bulk-result__top">
                    <button
                      type="button"
                      className="ep-bulk-result__why-btn"
                      aria-expanded={open}
                      onClick={() => setOpenBatchId(open ? null : batch.batch_id)}
                      style={{ fontWeight: 600 }}
                    >
                      Batch {batch.batch_id} {open ? "▲" : "▼"}
                    </button>
                    <span className="ep-bulk-result__meta">
                      <span className="ep-bulk-result__amount">
                        {batch.total_amount ?? "—"} {batch.currency ?? ""}
                      </span>
                      <span>{batch.item_count ?? batch.items.length} items</span>
                      <StatusBadge
                        label={descriptor.label}
                        color={descriptor.color}
                        soft={descriptor.soft}
                        icon={descriptor.icon}
                      />
                    </span>
                  </div>

                  {open ? (
                    <div className="ep-bulk-result__why-panel" role="region" aria-label="Batch detail">
                      {!descriptor.terminal ? (
                        <div
                          className="ep-money-banner ep-money-banner--warn"
                          role="status"
                          style={{ marginBottom: 12 }}
                        >
                          Still {descriptor.label.toLowerCase()} — tap Sync status for the latest, or
                          Reconcile to re-check every item against Horizon.
                        </div>
                      ) : null}
                      <div className="ep-money-actions" style={{ marginBottom: 12 }}>
                        <button
                          type="button"
                          className="ep-btn-secondary"
                          disabled={actionBusy !== null}
                          onClick={() => void runSync(batch.batch_id)}
                        >
                          {actionBusy === `sync:${batch.batch_id}` ? "Syncing…" : "Sync status"}
                        </button>
                        <button
                          type="button"
                          className="ep-btn-secondary"
                          disabled={actionBusy !== null}
                          onClick={() => void runReconcile(batch.batch_id)}
                        >
                          {actionBusy === `reconcile:${batch.batch_id}`
                            ? "Reconciling…"
                            : "Reconcile against Horizon"}
                        </button>
                      </div>

                      {report ? (
                        <div className="ep-bulk-result__summary" style={{ marginBottom: 12 }}>
                          Checked {report.items_checked} on-chain, {report.items_matched} already
                          matched
                          {report.drift_found
                            ? `, corrected ${report.items_corrected.length} that had drifted.`
                            : ", no drift found."}
                        </div>
                      ) : null}

                      {itemsLoadingId === batch.batch_id ? (
                        <p className="ep-muted">Loading items…</p>
                      ) : !batch.items.length ? (
                        <p className="ep-muted">
                          {descriptor.terminal
                            ? "No item detail available for this batch."
                            : "Item detail isn't ready yet — tap Sync status above to pull the latest."}
                        </p>
                      ) : null}

                      <ul className="ep-bulk-result__list" aria-label="Batch items">
                        {batch.items.map((item, index) => {
                          const tone = itemTone(item.status);
                          const rowKey = `${batch.batch_id}-${item.destination}-${index}`;
                          const whyOpen = openWhyKey === rowKey;
                          const explorerUrl =
                            tone === "ok"
                              ? stellarExplorerTxUrl({ txHash: item.tx_hash, network: "Stellar" })
                              : null;
                          return (
                            <li
                              key={rowKey}
                              className={`ep-bulk-result__row ep-bulk-result__row--${tone}`}
                            >
                              <span className="ep-bulk-result__icon" aria-hidden>
                                {tone === "ok" ? "✓" : tone === "failed" ? "✕" : "…"}
                              </span>
                              <div className="ep-bulk-result__main">
                                <div className="ep-bulk-result__top">
                                  <span className="ep-bulk-payout__addr" title={item.destination}>
                                    {item.destination}
                                  </span>
                                  <span className="ep-bulk-result__meta">
                                    <span className="ep-bulk-result__amount">
                                      {item.amount} {batch.currency ?? ""}
                                    </span>
                                    <span className="ep-bulk-result__badge">
                                      {item.status || "pending"}
                                    </span>
                                    {tone === "failed" ? (
                                      <button
                                        type="button"
                                        className="ep-bulk-result__why-btn"
                                        aria-expanded={whyOpen}
                                        onClick={() => setOpenWhyKey(whyOpen ? null : rowKey)}
                                      >
                                        {whyOpen ? "Hide" : "Why?"}
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
                                {whyOpen ? (
                                  <div
                                    className="ep-bulk-result__why-panel"
                                    role="region"
                                    aria-label="Failure reason"
                                  >
                                    {explainDisbursementFailure(item.error) ||
                                      "No further detail available."}
                                  </div>
                                ) : null}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="ep-money-actions">
        <button type="button" className="ep-btn-primary" onClick={onDone}>
          Done
        </button>
        <button
          type="button"
          className="ep-btn-secondary"
          onClick={() => void loadBatches()}
          disabled={loading}
        >
          {loading ? "Refreshing…" : "Refresh list"}
        </button>
      </div>
    </div>
  );
}

export default function DisbursementBatchHistory(props: Props) {
  if (MIXED_RAIL_BULK_PAYOUTS_ENABLED) {
    return <MixedRailHistory {...props} />;
  }
  return <StellarOnlyHistory {...props} />;
}
