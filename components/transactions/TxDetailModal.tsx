"use client";
import React from "react";
import StatusBadge from "@/components/ui/StatusBadge";

export type TxDetailModalProps = {
  txDetail: any;
  /** True while the fetch-by-id (GET /v1/transactions/{id}) is in flight. */
  isLoading?: boolean;
  /** Non-null while the order hasn't reached a terminal status yet. */
  liveStatus?: { label: string; isFetching: boolean } | null;
};

type StepState = "done" | "current" | "upcoming" | "error";

type ProgressStep = {
  key: string;
  label: string;
  state: StepState;
};

function formatTimestamp(iso?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

/** Derive a readable status progression from the canonical transaction status. */
function buildProgressSteps(status?: string): ProgressStep[] {
  const s = (status || "").toLowerCase();

  if (s === "failed") {
    return [
      { key: "created", label: "Created", state: "done" },
      { key: "processing", label: "Processing", state: "done" },
      { key: "failed", label: "Failed", state: "error" },
    ];
  }
  if (s === "canceled") {
    return [
      { key: "created", label: "Created", state: "done" },
      { key: "canceled", label: "Canceled", state: "error" },
    ];
  }
  if (s === "frozen") {
    return [
      { key: "created", label: "Created", state: "done" },
      { key: "processing", label: "Processing", state: "done" },
      { key: "frozen", label: "Frozen", state: "error" },
    ];
  }
  if (s === "refunded") {
    return [
      { key: "created", label: "Created", state: "done" },
      { key: "settled", label: "Settled", state: "done" },
      { key: "refunded", label: "Refunded", state: "current" },
    ];
  }
  if (s === "completed") {
    return [
      { key: "created", label: "Created", state: "done" },
      { key: "processing", label: "Processing", state: "done" },
      { key: "settled", label: "Settled", state: "done" },
    ];
  }
  // processing / unknown — in flight
  return [
    { key: "created", label: "Created", state: "done" },
    { key: "processing", label: "Processing", state: "current" },
    { key: "settled", label: "Settled", state: "upcoming" },
  ];
}

function DetailRow({
  label,
  value,
  mono = false,
  wrap = false,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  wrap?: boolean;
}) {
  if (value == null || value === "") return null;
  return (
    <div className="ep-txn-detail__row">
      <span className="ep-txn-detail__label">{label}</span>
      <span
        className={`ep-txn-detail__value${mono ? " ep-mono" : ""}${wrap ? " ep-txn-detail__value--wrap" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}

export default function TxDetailModal({ txDetail, isLoading, liveStatus }: TxDetailModalProps) {
  if (!txDetail) {
    return isLoading ? (
      <div className="ep-txn-detail ep-txn-detail--loading" role="status" aria-live="polite">
        <div className="ep-txn-detail__skeleton ep-txn-detail__skeleton--amount" />
        <div className="ep-txn-detail__skeleton ep-txn-detail__skeleton--line" />
        <div className="ep-txn-detail__skeleton ep-txn-detail__skeleton--pill" />
        <span className="ep-txn-detail__loading-label">Loading transaction…</span>
      </div>
    ) : null;
  }

  const created = formatTimestamp(txDetail.created_at);
  const updated = formatTimestamp(txDetail.updated_at);
  const steps = buildProgressSteps(txDetail.status);
  const showUpdated = updated && updated !== created;

  return (
    <div className="ep-txn-detail">
      <header className="ep-txn-detail__hero">
        <div
          className="ep-txn-detail__amount ep-mono"
          style={{ color: txDetail.amountColor || "var(--ink)" }}
        >
          {txDetail.amount}
        </div>
        <div className="ep-txn-detail__party">
          {txDetail.flagUrl ? (
            <span
              className="ep-flag"
              style={{ backgroundImage: `url(${txDetail.flagUrl})` }}
              aria-hidden
            />
          ) : null}
          <span>{txDetail.client}</span>
        </div>
        <div className="ep-txn-detail__status">
          <StatusBadge
            label={txDetail.statusLabel}
            color={txDetail.statusColor}
            soft={txDetail.statusSoft}
            size="md"
          />
        </div>
      </header>

      {liveStatus ? (
        <div
          className={`ep-txn-detail__live${liveStatus.isFetching ? " ep-txn-detail__live--fetching" : ""}`}
          role="status"
          aria-live="polite"
        >
          <span className="ep-txn-detail__live-dot" aria-hidden />
          <span>{liveStatus.label}</span>
        </div>
      ) : null}

      <ol className="ep-txn-detail__timeline" aria-label="Status progression">
        {steps.map((step) => (
          <li
            key={step.key}
            className={`ep-txn-detail__step ep-txn-detail__step--${step.state}`}
          >
            <span className="ep-txn-detail__step-marker" aria-hidden />
            <span className="ep-txn-detail__step-label">
              {step.label}
              <span className="ep-txn-detail__step-sr">
                {step.state === "done"
                  ? " — complete"
                  : step.state === "current"
                    ? " — current"
                    : step.state === "error"
                      ? " — issue"
                      : " — upcoming"}
              </span>
            </span>
          </li>
        ))}
      </ol>

      <div className="ep-txn-detail__rows">
        <DetailRow label="Reference" value={txDetail.ref} mono wrap />
        <DetailRow label="Rail" value={txDetail.type} />
        <DetailRow label="Settlement layer" value="USDC · Base" />
        {txDetail.wallet_address ? (
          <DetailRow label="Wallet" value={txDetail.wallet_address} mono wrap />
        ) : null}
        <DetailRow label="Created" value={created} mono />
        {showUpdated ? <DetailRow label="Last updated" value={updated} mono /> : null}
      </div>
    </div>
  );
}
