"use client";
import MbokaMark from "@/components/brand/MbokaMark";
import React from "react";
import ActivityList from "@/components/ui/ActivityList";

export type WalletsAccountCard = {
  currency: string;
  name: string;
  flagUrl: string | null;
  /** Rail chip under the name, e.g. "IBAN · SWIFT" or "Stablecoin · Base". */
  rail: string;
  /** Balance display — "—" until a real source exists. */
  balance: string;
  /** Truncated coordinate / network detail under the balance. */
  detail: string;
  statusLabel: string;
  statusColor: string;
  statusSoft: string;
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
  openCreateAccount: (
    kind: string,
    preferredNetwork?: string,
    preferredCurrency?: string,
  ) => () => void;
  /** When false, Stablecoin Account menu item is disabled (all slots open). */
  canCreateStablecoin?: boolean;
  /** When false, Bank account menu item is disabled (USD+EUR already open). */
  canCreateBank?: boolean;
  accounts: WalletsAccountCard[];
  /** True once verification has confirmed this principal can hold currency accounts. */
  eligible: boolean;
  eligibilityLoading: boolean;
  /** Human status from the eligibility check (e.g. "pending", "approved") when not yet eligible. */
  verificationStatus?: string;
  /** Set when the eligibility check itself failed (network/5xx) — distinct from a real "not eligible" result. */
  eligibilityErrorMessage?: string;
  accountsLoading: boolean;
  /**
   * When some account cards are already visible but another rail is still
   * fetching (e.g. IBAN ready, stablecoin walking entities), append a
   * trailing skeleton instead of blanking the whole strip.
   */
  accountsPendingMore?: boolean;
  accountsErrorMessage?: string;
  /** Re-fetch eligibility and/or deposit accounts after a failure. */
  onRetryAccounts?: () => void;
  walletsRecent: any[];
  goTransactions: () => void;
  /** Opens the Convert (quote → accept) flow from Accounts. */
  onConvert?: () => void;
  /**
   * The managed USDC Account surface, rendered as its own block under the
   * accounts row. Passed in as a node rather than folded into `accounts` so
   * simulated data never joins the real, API-backed array — and so the
   * expanded detail view isn't nested inside the horizontal scroller.
   */
  managedSection?: React.ReactNode;
};

function AccountCardSkeleton() {
  return (
    <div className="ep-wallets__skeleton" aria-hidden>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <div className="ep-wallets__skel-line" style={{ width: 38, height: 38, borderRadius: 12 }} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
          <div className="ep-wallets__skel-line ep-wallets__skel-line--title" />
          <div className="ep-wallets__skel-line" style={{ width: "40%" }} />
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
  const hasAccountCards = (p.accounts || []).length > 0;
  // Show the strip whenever we have (or are loading) cards — including
  // stablecoin rows while IBAN is still gated by KYB. Gate banner stays above.
  const showAccountsRow =
    !showError &&
    (hasAccountCards ||
      p.accountsLoading ||
      p.accountsPendingMore ||
      (!p.eligibilityLoading && p.eligible));
  const showEmpty =
    showAccountsRow &&
    !p.accountsLoading &&
    !p.accountsPendingMore &&
    p.eligible &&
    !hasAccountCards;

  return (
    <div
      data-screen-label="Accounts"
      data-compact={p.isMobile ? "true" : "false"}
      className="ep-wallets"
    >
      <section className="ep-wallets__hero" aria-label="Settlement wallet">
        <div className="ep-wallets__hero-main">
          <span className="ep-wallets__eyebrow">Main wallet · settlement layer</span>
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
          Currency accounts{" "}
          <span className="ep-wallets__section-count">· {p.accountsCount}</span>
        </h2>
        <div className="ep-wallets__section-actions">
          {p.onConvert ? (
            <button type="button" onClick={p.onConvert} className="ep-wallets__text-btn">
              Convert
            </button>
          ) : null}
          {p.eligible ? (
            <div className="ep-wallets__add-wrap">
              <button
                type="button"
                onClick={p.toggleAddAccountMenu}
                className="ep-wallets__text-btn ep-wallets__text-btn--accent"
                aria-expanded={p.addAccountMenu}
                aria-haspopup="menu"
              >
                + New account
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
                      disabled={p.canCreateBank === false}
                      title={
                        p.canCreateBank === false
                          ? "USD and EUR accounts are already open"
                          : undefined
                      }
                      className="ep-wallets__menu-item"
                    >
                      <span className="ep-wallets__menu-icon" aria-hidden>
                        FX
                      </span>
                      <span className="ep-wallets__menu-copy">
                        <span className="ep-wallets__menu-label">Bank account</span>
                        <span className="ep-wallets__menu-hint">
                          {p.canCreateBank === false
                            ? "USD and EUR already open"
                            : "Fiat rails · IBAN / local deposit"}
                        </span>
                      </span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={p.openCreateAccount("stablecoin")}
                      disabled={p.canCreateStablecoin === false}
                      title={
                        p.canCreateStablecoin === false
                          ? "USDC accounts already open on every available network"
                          : undefined
                      }
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
                          {p.canCreateStablecoin === false
                            ? "Base, Polygon, and Stellar already open"
                            : "On-chain deposit · network specific"}
                        </span>
                      </span>
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {p.eligibilityLoading ? (
        <div className="ep-wallets__banner ep-wallets__banner--loading" role="status">
          <MbokaMark size={18} motion="inflight" title={null} />
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
          aria-busy={p.accountsLoading || Boolean(p.accountsPendingMore)}
          aria-label="Currency accounts"
        >
          {p.accountsLoading && !hasAccountCards ? (
            <>
              <AccountCardSkeleton />
              <AccountCardSkeleton />
            </>
          ) : (
            <>
              {showEmpty ? (
                <div className="ep-wallets__empty">
                  <div className="ep-wallets__empty-title">No currency accounts yet</div>
                  <div className="ep-wallets__empty-body">
                    Issue a bank or stablecoin account to receive deposits. Coordinates appear here once provisioned.
                  </div>
                </div>
              ) : null}
              {(p.accounts || []).map((acc, i) => (
                <button
                  key={`${acc.currency}-${i}`}
                  type="button"
                  onClick={acc.openDetail}
                  className="ep-wallets__card"
                  aria-label={`${acc.name} account, ${acc.rail}, balance ${acc.balance}. View details`}
                >
                  <div className="ep-wallets__card-identity">
                    <span className="ep-wallets__flag" aria-hidden>
                      {acc.flagUrl ? (
                        <div
                          className="ep-wallets__flag-img"
                          style={{ backgroundImage: `url(${acc.flagUrl})` }}
                        />
                      ) : (
                        <span className="ep-wallets__flag-glyph">◈</span>
                      )}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div className="ep-wallets__card-name">{acc.name}</div>
                      <div className="ep-wallets__card-rail">{acc.rail}</div>
                    </div>
                  </div>
                  <div className="ep-wallets__card-balance">{acc.balance}</div>
                  <div className="ep-wallets__card-detail">{acc.detail}</div>
                </button>
              ))}
              {p.accountsPendingMore ? <AccountCardSkeleton /> : null}
            </>
          )}
          {p.eligible && !p.accountsLoading && p.canCreateBank !== false ? (
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

      {p.managedSection}

      <ActivityList
        title="Recent activity"
        items={p.walletsRecent}
        onViewAll={p.goTransactions}
        viewAllLabel="View all →"
      />
    </div>
  );
}
