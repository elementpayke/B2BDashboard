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

type StepState = "done" | "current" | "upcoming" | "failed";

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
      { key: "failed", label: "Failed", state: "failed" },
    ];
  }
  if (s === "canceled") {
    return [
      { key: "created", label: "Created", state: "done" },
      { key: "canceled", label: "Canceled", state: "failed" },
    ];
  }
  if (s === "frozen") {
    return [
      { key: "created", label: "Created", state: "done" },
      { key: "processing", label: "Processing", state: "done" },
      { key: "frozen", label: "Frozen", state: "failed" },
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
  last = false,
  children,
}: {
  label: string;
  value?: React.ReactNode;
  mono?: boolean;
  last?: boolean;
  children?: React.ReactNode;
}) {
  const content = children ?? value;
  if (content == null || content === "") return null;
  return (
    <div className={`ep-txn-detail__row${last ? " ep-txn-detail__row--last" : ""}`}>
      <span className="ep-txn-detail__label">{label}</span>
      <span className={`ep-txn-detail__value${mono ? " ep-mono" : ""}`}>{content}</span>
    </div>
  );
}

export default function TxDetailModal({ txDetail, isLoading, liveStatus }: TxDetailModalProps) {
  if (!txDetail) {
    return isLoading ? (
      <div className="ep-txn-detail__loading" role="status" aria-live="polite">
        <span className="ep-txn-detail__spinner" aria-hidden />
        Loading transaction…
      </div>
    ) : null;
  }

  const created = formatTimestamp(txDetail.created_at);
  const updated = formatTimestamp(txDetail.updated_at);
  const steps = buildProgressSteps(txDetail.status);
  const showUpdated = Boolean(updated && updated !== created);
  const rows = [
    { label: "Reference", value: txDetail.ref, mono: true },
    { label: "Rail", value: txDetail.type },
    { label: "Settlement layer", value: "USDC · Base" },
    txDetail.wallet_address
      ? {
          label: "Wallet",
          value: (
            <span className="ep-txn-detail__wallet ep-mono" title={txDetail.wallet_address}>
              {txDetail.wallet_address}
            </span>
          ),
        }
      : null,
    created ? { label: "Created", value: created, mono: true } : null,
    showUpdated ? { label: "Last updated", value: updated, mono: true } : null,
  ].filter(Boolean) as { label: string; value: React.ReactNode; mono?: boolean }[];

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

      <ol className="ep-txn-detail__progress" aria-label="Status progression">
        {steps.map((step, index) => (
          <li
            key={step.key}
            className={`ep-txn-detail__step ep-txn-detail__step--${step.state}`}
          >
            {index > 0 ? <span className="ep-txn-detail__step-line" aria-hidden /> : null}
            <span className="ep-txn-detail__step-dot" aria-hidden />
            <span className="ep-txn-detail__step-label">
              {step.label}
              <span className="ep-txn-detail__sr">
                {step.state === "done"
                  ? " — complete"
                  : step.state === "current"
                    ? " — current"
                    : step.state === "failed"
                      ? " — issue"
                      : " — upcoming"}
              </span>
            </span>
          </li>
        ))}
      </ol>

      <div className="ep-txn-detail__rows">
        {rows.map((row, i) => (
          <DetailRow
            key={row.label}
            label={row.label}
            mono={row.mono}
            last={i === rows.length - 1}
          >
            {row.value}
          </DetailRow>
        ))}
      </div>
    </div>
  );
}
