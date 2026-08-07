"use client";
import React from "react";
import ActivityList from "@/components/ui/ActivityList";
import StatusBadge from "@/components/ui/StatusBadge";

export type WalletsAccountCard = {
  currency: string;
  name: string;
  flagUrl: string | null;
  statusLabel: string;
  statusColor: string;
  statusSoft: string;
  primaryDetail: string;
  secondaryDetail: string;
  openDetail: () => void;
};

export type WalletsScreenProps = {
  isMobile: boolean;
  mainWalletBalance: string;
  mainWalletSub: string;
  stableTabs: any[];
  accountsCount: number;
  addAccountMenu: boolean;
  toggleAddAccountMenu: () => void;
  closeAddAccountMenu: () => void;
  openCreateAccount: (kind: string) => () => void;
  accounts: WalletsAccountCard[];
  /** True once verification has confirmed this principal can hold currency accounts. */
  eligible: boolean;
  eligibilityLoading: boolean;
  /** Human status from the eligibility check (e.g. "pending", "approved") when not yet eligible. */
  verificationStatus?: string;
  /** Set when the eligibility check itself failed (network/5xx) — distinct from a real "not eligible" result. */
  eligibilityErrorMessage?: string;
  accountsLoading: boolean;
  accountsErrorMessage?: string;
  /** Re-fetch eligibility and/or deposit accounts after a failure. */
  onRetryAccounts?: () => void;
  walletsRecent: any[];
  goTransactions: () => void;
};

function detailLabel(primaryDetail: string): string {
  if (!primaryDetail || primaryDetail === "Coordinates pending") return "Deposit details";
  if (primaryDetail.includes("··") || /^[A-Z]{2}\d/.test(primaryDetail.replace(/\s/g, ""))) {
    return "Account number";
  }
  return "Bank";
}

function AccountCardSkeleton() {
  return (
    <div className="ep-wallets__skeleton" aria-hidden>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <div className="ep-wallets__skel-line" style={{ width: 40, height: 40, borderRadius: 12 }} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
          <div className="ep-wallets__skel-line ep-wallets__skel-line--title" />
          <div className="ep-wallets__skel-line" style={{ width: "28%" }} />
        </div>
      </div>
      <div className="ep-wallets__skel-line ep-wallets__skel-line--body" />
      <div className="ep-wallets__skel-line ep-wallets__skel-line--meta" />
    </div>
  );
}

export default function WalletsScreen(p: WalletsScreenProps) {
  const showGate = !p.eligibilityLoading && !p.eligible && !p.eligibilityErrorMessage;
  const showError = Boolean(p.eligibilityErrorMessage || p.accountsErrorMessage);
  // Hide the strip on list failures / gate so "0 accounts" doesn't look like success.
  // Also hide while eligibility is still resolving — avoids an empty strip flash.
  const showAccountsRow = !showGate && !showError && !p.eligibilityLoading;
  const showEmpty =
    showAccountsRow &&
    !p.accountsLoading &&
    p.eligible &&
    (p.accounts || []).length === 0;

  return (
    <div
      data-screen-label="Wallets"
      data-compact={p.isMobile ? "true" : "false"}
      className="ep-wallets"
    >
      <section className="ep-wallets__hero" aria-label="Settlement wallet">
        <div className="ep-wallets__hero-main">
          <span className="ep-wallets__eyebrow">Settlement wallet · stablecoin</span>
          <div className="ep-wallets__balance" aria-live="polite">
            {p.mainWalletBalance}
          </div>
          <div className="ep-wallets__balance-sub">{p.mainWalletSub}</div>
        </div>
        <div
          className="ep-wallets__asset-switch"
          role="tablist"
          aria-label="Settlement asset"
        >
          {(p.stableTabs || []).map((st: any, i: number) => (
            <button
              key={st.label ?? i}
              type="button"
              role="tab"
              aria-selected={st.bg === "var(--indigo)"}
              onClick={st.select}
              className="ep-wallets__asset-btn"
              style={{ background: st.bg, color: st.color }}
            >
              {st.label}
            </button>
          ))}
        </div>
      </section>

      <div className="ep-wallets__section-head">
        <h2 className="ep-wallets__section-title">
          Fiat currency accounts{" "}
          <span className="ep-wallets__section-count">· {p.accountsCount}</span>
        </h2>
        {p.eligible ? (
          <div className="ep-wallets__add-wrap">
            <button
              type="button"
              onClick={p.toggleAddAccountMenu}
              className="ep-wallets__add-btn"
              aria-expanded={p.addAccountMenu}
              aria-haspopup="menu"
            >
              <span aria-hidden style={{ fontSize: "15px", lineHeight: 1 }}>
                +
              </span>
              Add Account
            </button>
            {p.addAccountMenu ? (
              <>
                <div
                  className="ep-wallets__menu-backdrop"
                  onClick={p.closeAddAccountMenu}
                  aria-hidden
                />
                <div className="ep-wallets__menu" role="menu" aria-label="Account type">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={p.openCreateAccount("bank")}
                    className="ep-wallets__menu-item"
                  >
                    <span className="ep-wallets__menu-icon" aria-hidden>
                      FX
                    </span>
                    <span className="ep-wallets__menu-copy">
                      <span className="ep-wallets__menu-label">Bank account</span>
                      <span className="ep-wallets__menu-hint">
                        Fiat rails · IBAN / local deposit
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={p.openCreateAccount("stablecoin")}
                    className="ep-wallets__menu-item"
                  >
                    <span
                      className="ep-wallets__menu-icon ep-wallets__menu-icon--stable"
                      aria-hidden
                    >
                      SC
                    </span>
                    <span className="ep-wallets__menu-copy">
                      <span className="ep-wallets__menu-label">Stablecoin account</span>
                      <span className="ep-wallets__menu-hint">
                        On-chain deposit · network specific
                      </span>
                    </span>
                  </button>
                </div>
              </>
            ) : null}
          </div>
        ) : null}
      </div>

      {p.eligibilityLoading ? (
        <div className="ep-wallets__banner ep-wallets__banner--loading" role="status">
          <span className="ep-wallets__spinner" aria-hidden />
          <span className="ep-wallets__banner-text" style={{ color: "var(--muted)" }}>
            Checking account eligibility…
          </span>
        </div>
      ) : null}

      {showGate ? (
        <div className="ep-wallets__banner ep-wallets__banner--gate" role="note">
          <span className="ep-wallets__banner-badge">Verification required</span>
          <div className="ep-wallets__banner-text">
            Complete business verification before issuing currency accounts.
            {p.verificationStatus ? (
              <span className="ep-wallets__banner-meta">
                Current status: {p.verificationStatus}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}

      {showError ? (
        <div className="ep-wallets__banner ep-wallets__banner--error" role="alert">
          <span className="ep-wallets__banner-text" style={{ color: "var(--red)" }}>
            {p.eligibilityErrorMessage || p.accountsErrorMessage}
          </span>
          {p.onRetryAccounts ? (
            <button type="button" onClick={p.onRetryAccounts} className="ep-wallets__retry">
              Retry
            </button>
          ) : null}
        </div>
      ) : null}

      {showAccountsRow ? (
        <div
          className="ep-wallets__strip ep-scroll-hint"
          aria-busy={p.accountsLoading}
          aria-label="Currency accounts"
        >
          {p.accountsLoading ? (
            <>
              <AccountCardSkeleton />
              <AccountCardSkeleton />
            </>
          ) : (
            <>
              {showEmpty ? (
                <div className="ep-wallets__empty">
                  <div className="ep-wallets__empty-title">No fiat accounts yet</div>
                  <div className="ep-wallets__empty-body">
                    Issue a bank account to receive local deposits that settle to your stablecoin wallet. Coordinates appear here once provisioned.
                  </div>
                </div>
              ) : null}
              {(p.accounts || []).map((acc, i) => (
                <button
                  key={`${acc.currency}-${i}`}
                  type="button"
                  onClick={acc.openDetail}
                  className="ep-wallets__card"
                  aria-label={`${acc.name} account, ${acc.statusLabel}. View details`}
                >
                  <div className="ep-wallets__card-top">
                    <div className="ep-wallets__card-identity">
                      <span className="ep-wallets__flag" aria-hidden>
                        {acc.flagUrl ? (
                          <div
                            className="ep-wallets__flag-img"
                            style={{ backgroundImage: `url(${acc.flagUrl})` }}
                          />
                        ) : (
                          acc.currency.slice(0, 1)
                        )}
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <div className="ep-wallets__card-name">{acc.name}</div>
                        <div className="ep-wallets__card-code">{acc.currency} · Fiat</div>
                      </div>
                    </div>
                    <StatusBadge
                      label={acc.statusLabel}
                      color={acc.statusColor}
                      soft={acc.statusSoft}
                      size="sm"
                    />
                  </div>
                  <div>
                    <div className="ep-wallets__card-detail-label">
                      {detailLabel(acc.primaryDetail)}
                    </div>
                    <div className="ep-wallets__card-detail">{acc.primaryDetail}</div>
                    {acc.secondaryDetail ? (
                      <div className="ep-wallets__card-secondary">{acc.secondaryDetail}</div>
                    ) : null}
                  </div>
                  <div className="ep-wallets__card-footer">
                    <span className="ep-wallets__card-cta">View details</span>
                    <span aria-hidden style={{ color: "var(--muted2)", fontWeight: 700 }}>
                      →
                    </span>
                  </div>
                </button>
              ))}
            </>
          )}
          {p.eligible && !p.accountsLoading ? (
            <button
              type="button"
              onClick={p.openCreateAccount("bank")}
              className="ep-wallets__new-card"
            >
              <span className="ep-wallets__new-icon" aria-hidden>
                +
              </span>
              <span className="ep-wallets__new-label">New account</span>
            </button>
          ) : null}
        </div>
      ) : null}

      <ActivityList title="Recent activity" items={p.walletsRecent} onViewAll={p.goTransactions} />
    </div>
  );
}
