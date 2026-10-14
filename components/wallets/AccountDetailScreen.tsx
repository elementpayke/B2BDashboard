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

const ACTION_ICON_PATHS: Record<"send" | "fund" | "convert" | "details" | "more", string[]> = {
  send: ["M21.5 2.5L11 13", "M21.5 2.5L15 21l-4-8-8-4 18.5-6.5z"],
  fund: ["M12 5v14", "M5 12h14"],
  convert: ["M7 7h11l-3-3", "M17 17H6l3 3"],
  details: ["M12 11v6", "M12 7.5v.01", "M3.5 12a8.5 8.5 0 1017 0 8.5 8.5 0 00-17 0z"],
  more: ["M5 12h.01", "M12 12h.01", "M19 12h.01"],
};

function ActionIcon({ name }: { name: keyof typeof ACTION_ICON_PATHS }) {
  return (
    <span className="ep-acct-detail__action-icon" aria-hidden>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        {ACTION_ICON_PATHS[name].map((d) => (
          <path
            key={d}
            d={d}
            stroke="currentColor"
            strokeWidth={name === "more" ? 3 : 2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
      </svg>
    </span>
  );
}

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
  fundDisabledReason?: string;
  /** Send is blocked once the wallet is closed. */
  canSend?: boolean;
  /** Close is offered for stablecoin wallets (block or delete). */
  canClose?: boolean;
  closeDisabledReason?: string;
  onBack: () => void;
  onOpenDetails: () => void;
  onFund: () => void;
  onSend: () => void;
  /** Same-currency VA→VA move (fiat). Offered from the "More" menu. */
  onMove?: () => void;
  /** External bank payout (fiat). Offered from the "More" menu. */
  onPayout?: () => void;
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
  fundDisabledReason,
  canSend = true,
  canClose = false,
  closeDisabledReason,
  onBack,
  onOpenDetails,
  onFund,
  onSend,
  onMove,
  onPayout,
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
  const fundHint = fundDisabledReason || closedHint;

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
              onClick={onSend}
              className="ep-acct-detail__action ep-acct-detail__action--primary"
              disabled={!canSend}
              title={!canSend ? closedHint : undefined}
            >
              <ActionIcon name="send" />
              <span className="ep-acct-detail__action-label">Send</span>
            </button>
            <button
              type="button"
              onClick={onFund}
              className="ep-acct-detail__action"
              disabled={!canFund}
              title={!canFund ? fundHint : undefined}
            >
              <ActionIcon name="fund" />
              <span className="ep-acct-detail__action-label">Fund</span>
            </button>
            {canConvert && onConvert ? (
              <button type="button" onClick={onConvert} className="ep-acct-detail__action">
                <ActionIcon name="convert" />
                <span className="ep-acct-detail__action-label">Convert</span>
              </button>
            ) : null}
            <button type="button" onClick={onOpenDetails} className="ep-acct-detail__action">
              <ActionIcon name="details" />
              <span className="ep-acct-detail__action-label">Details</span>
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
                <ActionIcon name="more" />
                <span className="ep-acct-detail__action-label" aria-hidden>
                  More
                </span>
              </button>
              {menuOpen ? (
                <>
                  <div
                    className="ep-acct-detail__menu-backdrop"
                    onClick={() => setMenuOpen(false)}
                    aria-hidden
                  />
                  <div className="ep-acct-detail__menu" role="menu" aria-label="More account actions">
                    {/* Less common ways to move money out live here so the main
                        row stays to one action per job (Send covers payouts). */}
                    {onMove ? (
                      <button
                        type="button"
                        role="menuitem"
                        className="ep-acct-detail__menu-item"
                        onClick={() => {
                          setMenuOpen(false);
                          onMove();
                        }}
                      >
                        <span className="ep-acct-detail__menu-copy">
                          <span className="ep-acct-detail__menu-label">Move between accounts</span>
                          <span className="ep-acct-detail__menu-hint">
                            Same-currency transfer to another of your accounts
                          </span>
                        </span>
                      </button>
                    ) : null}
                    {onPayout ? (
                      <button
                        type="button"
                        role="menuitem"
                        className="ep-acct-detail__menu-item"
                        onClick={() => {
                          setMenuOpen(false);
                          onPayout();
                        }}
                      >
                        <span className="ep-acct-detail__menu-copy">
                          <span className="ep-acct-detail__menu-label">Bank payout</span>
                          <span className="ep-acct-detail__menu-hint">
                            Pay out to an external bank with this account&apos;s partner methods
                          </span>
                        </span>
                      </button>
                    ) : null}
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
