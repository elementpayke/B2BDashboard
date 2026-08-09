"use client";
import React from "react";
import ActivityList, { type ActivityItem } from "@/components/ui/ActivityList";
import StatusBadge from "@/components/ui/StatusBadge";

export type AccountDetailSummaryLine = {
  k: string;
  v: string;
};

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
  canConvert?: boolean;
  onBack: () => void;
  onOpenDetails: () => void;
  onFund: () => void;
  onSend: () => void;
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
  canConvert = true,
  onBack,
  onOpenDetails,
  onFund,
  onSend,
  onViewAllTx,
}: AccountDetailScreenProps) {
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
            {currency.slice(0, 1)}
          </span>
        )}
        <div className="ep-acct-detail__identity-text">
          <h2 className="ep-acct-detail__name">{name}</h2>
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
          <div>
            <div className="ep-acct-detail__balance-label">{name} balance</div>
            <div className="ep-acct-detail__balance" aria-live="polite">
              {balance}
            </div>
            {balanceSub ? (
              <div className="ep-acct-detail__balance-sub">{balanceSub}</div>
            ) : null}
          </div>
          <div className="ep-acct-detail__actions">
            <button
              type="button"
              onClick={onOpenDetails}
              className="ep-acct-detail__action"
            >
              Details
            </button>
            {canConvert ? (
              <button
                type="button"
                onClick={onFund}
                className="ep-acct-detail__action"
              >
                Fund <span aria-hidden>＋</span>
              </button>
            ) : null}
            <button
              type="button"
              onClick={onSend}
              className="ep-acct-detail__action ep-acct-detail__action--primary"
            >
              Send
            </button>
          </div>
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
        emptyLabel="No transactions for this account yet"
      />
    </div>
  );
}
