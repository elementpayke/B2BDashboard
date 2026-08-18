"use client";
import React, { useEffect, useState } from "react";
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
  /** Fund is blocked once the wallet is closed. */
  canFund?: boolean;
  /** Send is blocked once the wallet is closed. */
  canSend?: boolean;
  /** Close is offered for stablecoin wallets (block or delete). */
  canClose?: boolean;
  closeDisabledReason?: string;
  onBack: () => void;
  onOpenDetails: () => void;
  onFund: () => void;
  onSend: () => void;
  onConvert?: () => void;
  onCloseAccount?: () => void;
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
  canFund = true,
  canSend = true,
  canClose = false,
  closeDisabledReason,
  onBack,
  onOpenDetails,
  onFund,
  onSend,
  onConvert,
  onCloseAccount,
  onViewAllTx,
}: AccountDetailScreenProps) {
  // Visual shell only — range selection does not invent a history series.
  const [range, setRange] = useState<BalanceRange>("30 Days");
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const closedHint = "This account is closed";

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
              disabled={!canFund}
              title={!canFund ? closedHint : undefined}
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
              disabled={!canSend}
              title={!canSend ? closedHint : undefined}
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
            <div className="ep-acct-detail__more-wrap">
              <button
                type="button"
                className="ep-acct-detail__action ep-acct-detail__action--more"
                aria-label="More account actions"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((open) => !open)}
              >
                ⋯
              </button>
              {menuOpen ? (
                <>
                  <div
                    className="ep-acct-detail__menu-backdrop"
                    onClick={() => setMenuOpen(false)}
                    aria-hidden
                  />
                  <div className="ep-acct-detail__menu" role="menu" aria-label="Account actions">
                    <button
                      type="button"
                      role="menuitem"
                      className="ep-acct-detail__menu-item ep-acct-detail__menu-item--danger"
                      disabled={!canClose || !onCloseAccount}
                      title={!canClose ? closeDisabledReason : undefined}
                      onClick={() => {
                        if (!canClose || !onCloseAccount) return;
                        setMenuOpen(false);
                        onCloseAccount();
                      }}
                    >
                      <span className="ep-acct-detail__menu-copy">
                        <span className="ep-acct-detail__menu-label">Close account</span>
                        <span className="ep-acct-detail__menu-hint">
                          {closeDisabledReason ||
                            "Block this wallet or delete it from your accounts"}
                        </span>
                      </span>
                    </button>
                  </div>
                </>
              ) : null}
            </div>
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
