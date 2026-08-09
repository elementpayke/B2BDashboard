"use client";
import React, { useState } from "react";
import ActivityList, { type ActivityItem } from "@/components/ui/ActivityList";
import StatusBadge from "@/components/ui/StatusBadge";

export type AccountDetailSummaryLine = {
  k: string;
  v: string;
};

const BALANCE_RANGES = ["7 Days", "30 Days", "90 Days"] as const;
type BalanceRange = (typeof BALANCE_RANGES)[number];

export type AccountDetailScreenProps = {
  name: string;
  currency: string;
  flagUrl: string | null;
  railLabel: string;
  statusLabel: string;
  statusColor: string;
  statusSoft: string;
  /** No invented balances — "—" until a real source exists. */
  balance: string;
  balanceSub?: string;
  summaryLines: AccountDetailSummaryLine[];
  recent: ActivityItem[];
  /** Show Convert in the action row (fiat accounts). */
  canConvert?: boolean;
  onBack: () => void;
  onOpenDetails: () => void;
  onFund: () => void;
  onSend: () => void;
  onConvert?: () => void;
  onViewAllTx: () => void;
};

export default function AccountDetailScreen({
  name,
  currency,
  flagUrl,
  railLabel,
  statusLabel,
  statusColor,
  statusSoft,
  balance,
  balanceSub,
  summaryLines,
  recent,
  canConvert = false,
  onBack,
  onOpenDetails,
  onFund,
  onSend,
  onConvert,
  onViewAllTx,
}: AccountDetailScreenProps) {
  // Visual shell only — range selection does not invent a history series.
  const [range, setRange] = useState<BalanceRange>("30 Days");

  return (
    <div data-screen-label="Account detail" className="ep-acct-detail">
      <button type="button" onClick={onBack} className="ep-acct-detail__back">
        ← Accounts
      </button>

      <div className="ep-acct-detail__identity">
        {flagUrl ? (
          <div
            className="ep-acct-detail__flag"
            style={{ backgroundImage: `url(${flagUrl})` }}
            role="img"
            aria-label={`${currency} flag`}
          />
        ) : (
          <span className="ep-acct-detail__flag-fallback" aria-hidden>
            ◈
          </span>
        )}
        <div className="ep-acct-detail__identity-text">
          <h1 className="ep-acct-detail__name">{name}</h1>
          <div className="ep-acct-detail__meta">
            <span className="ep-acct-detail__rail">{railLabel}</span>
            <StatusBadge
              label={statusLabel}
              color={statusColor}
              soft={statusSoft}
              size="sm"
            />
          </div>
        </div>
      </div>

      <section className="ep-acct-detail__hero" aria-label={`${name} balance`}>
        <div className="ep-acct-detail__hero-top">
          <div className="ep-acct-detail__hero-balance">
            <div className="ep-acct-detail__balance-label">{name} balance</div>
            <div className="ep-acct-detail__balance" aria-live="polite">
              {balance}
            </div>
            {balanceSub ? (
              <div className="ep-acct-detail__balance-sub">{balanceSub}</div>
            ) : null}
          </div>
          <div className="ep-acct-detail__actions" role="group" aria-label="Account actions">
            <button
              type="button"
              onClick={onOpenDetails}
              className="ep-acct-detail__action"
            >
              Details
            </button>
            <button
              type="button"
              onClick={onFund}
              className="ep-acct-detail__action"
            >
              Fund <span aria-hidden>＋</span>
            </button>
            {canConvert && onConvert ? (
              <button
                type="button"
                onClick={onConvert}
                className="ep-acct-detail__action"
              >
                Convert
              </button>
            ) : null}
            <button
              type="button"
              onClick={onSend}
              className="ep-acct-detail__action ep-acct-detail__action--primary"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M21.5 2.5L11 13"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M21.5 2.5L15 21l-4-8-8-4 18.5-6.5z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Send
            </button>
          </div>
        </div>

        <div
          className="ep-acct-detail__ranges"
          role="tablist"
          aria-label="Balance history range"
        >
          {BALANCE_RANGES.map((r) => (
            <button
              key={r}
              type="button"
              role="tab"
              aria-selected={range === r}
              data-active={range === r ? "true" : "false"}
              className="ep-acct-detail__range"
              onClick={() => setRange(r)}
            >
              {r}
            </button>
          ))}
        </div>

        {/* Visual shell only — no invented chart series until a real balance source exists. */}
        <div className="ep-acct-detail__chart" aria-hidden>
          <div className="ep-acct-detail__chart-line" />
        </div>
        <div className="ep-acct-detail__chart-empty" role="status">
          Balance history not yet available
        </div>
      </section>

      {summaryLines.length ? (
        <div className="ep-acct-detail__summary" aria-label="Account summary">
          {summaryLines.map((ln) => (
            <div key={ln.k} className="ep-acct-detail__summary-row">
              <span className="ep-acct-detail__summary-k">{ln.k}</span>
              <span className="ep-acct-detail__summary-v">{ln.v}</span>
            </div>
          ))}
        </div>
      ) : null}

      <ActivityList
        title="Recent transactions"
        items={recent}
        onViewAll={onViewAllTx}
        viewAllLabel="View all →"
        emptyLabel="No transactions for this account yet"
      />
    </div>
  );
}
