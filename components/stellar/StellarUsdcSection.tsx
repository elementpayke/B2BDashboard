"use client";
import React, { useMemo, useState } from "react";
import ActivityList from "@/components/ui/ActivityList";
import StatusBadge from "@/components/ui/StatusBadge";
import ExternalWalletDepositModal from "@/components/stellar/ExternalWalletDepositModal";
import FundUsdcAccountModal from "@/components/stellar/FundUsdcAccountModal";
import ReceiveExternalWalletModal from "@/components/stellar/ReceiveExternalWalletModal";
import { useStellarAccount, useStellarActivity } from "@/lib/hooks/useStellar";
import { openBrandedDocument } from "@/lib/documents/brandedDocument";
import {
  buildStellarDetailRows,
  buildStellarReceipt,
  isStellarReceiptable,
  presentStellarActivity,
} from "@/lib/services/stellarPresentation";
import {
  describeStellarStatus,
  type StellarActivity,
  STELLAR_ASSET,
  STELLAR_DEMO_LABEL,
  STELLAR_NETWORK,
} from "@/lib/services/stellarSimulation";

/**
 * The managed USDC Account surface.
 *
 * Everything simulated lives under this component: it owns its own queries,
 * its own modals, and never writes into the dashboard's real account or
 * balance state. Deleting this file and `lib/services/stellarSimulation.ts`
 * removes the whole demo cleanly.
 *
 * Naming discipline from the brief: the product noun is "USDC Account".
 * "Stellar" only ever appears as secondary metadata, and "wallet" only refers
 * to the *user's external* wallet, never to this account.
 */

type Modal = null | "fund" | "wallet-deposit" | "receive" | "activity";

const MODAL_TITLE: Record<Exclude<Modal, null>, string> = {
  fund: "Fund USDC Account",
  "wallet-deposit": "Deposit from external wallet",
  receive: "Receive from external wallet",
  activity: "Transaction",
};

function money(value: string): string {
  const n = Number(value);
  return Number.isFinite(n)
    ? new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
    : value;
}

export default function StellarUsdcSection({ isMobile }: { isMobile: boolean }) {
  const [open, setOpen] = useState(false);
  const [modal, setModal] = useState<Modal>(null);
  const [selected, setSelected] = useState<StellarActivity | null>(null);

  const { account, isLoading, isError, refetch } = useStellarAccount(true);
  const activityQuery = useStellarActivity(open);

  const items = useMemo(
    () =>
      (activityQuery.data ?? []).map((a) => ({
        ...presentStellarActivity(a),
        openDetail: () => {
          setSelected(a);
          setModal("activity");
        },
      })),
    [activityQuery.data],
  );

  if (isLoading) {
    return (
      <div className="ep-stellar-card ep-stellar-card--loading" aria-busy>
        <div className="ep-wallets__skel-line ep-wallets__skel-line--title" />
        <div className="ep-wallets__skel-line ep-wallets__skel-line--body" />
      </div>
    );
  }
  if (isError || !account) {
    return (
      <div className="ep-wallets__banner ep-wallets__banner--error" role="alert">
        <span className="ep-wallets__banner-text" style={{ color: "var(--red)" }}>
          Couldn&apos;t load your {STELLAR_ASSET} Account.
        </span>
        <button type="button" className="ep-wallets__retry" onClick={() => refetch()}>
          Retry
        </button>
      </div>
    );
  }

  const status = describeStellarStatus(account.status);

  /* ── collapsed: a single card under the accounts row ── */
  if (!open) {
    return (
      <section className="ep-stellar-section" aria-label="Managed account">
        <div className="ep-wallets__section-head">
          <h2 className="ep-wallets__section-title">Managed account</h2>
        </div>
        <button
          type="button"
          className="ep-wallets__card ep-stellar-card"
          onClick={() => setOpen(true)}
          aria-label={`${account.name}, managed account on ${STELLAR_NETWORK}, balance ${money(account.availableBalance)} ${STELLAR_ASSET}. View details`}
        >
          <div className="ep-wallets__card-identity">
            <span className="ep-wallets__flag" aria-hidden>
              <span className="ep-wallets__flag-glyph">◈</span>
            </span>
            <div style={{ minWidth: 0 }}>
              <div className="ep-wallets__card-name">{account.name}</div>
              <div className="ep-wallets__card-rail">Managed account · {STELLAR_NETWORK}</div>
            </div>
            <span className="ep-stellar-demo-badge">{STELLAR_DEMO_LABEL}</span>
          </div>
          <div className="ep-wallets__card-balance">
            {money(account.availableBalance)} <span className="ep-stellar-card__asset">{STELLAR_ASSET}</span>
          </div>
          <div className="ep-wallets__card-detail">
            Pending {money(account.pendingBalance)} · {status.label}
          </div>
        </button>
      </section>
    );
  }

  /* ── expanded: the account detail ── */
  return (
    <section className="ep-stellar-panel" aria-label={`${account.name} details`}>
      <button type="button" className="ep-money-back-link" onClick={() => setOpen(false)}>
        ← Accounts
      </button>

      <header className="ep-stellar-panel__head">
        <div>
          <div className="ep-stellar-panel__label">
            Available balance
            <StatusBadge
              label={status.label}
              icon={status.icon}
              color={status.color}
              soft={status.soft}
            />
            <span className="ep-stellar-demo-badge">{STELLAR_DEMO_LABEL}</span>
          </div>
          <div className="ep-stellar-panel__balance ep-mono">
            {money(account.availableBalance)} <span>{STELLAR_ASSET}</span>
          </div>
          <div className="ep-stellar-panel__sub">
            Pending <b className="ep-mono">{money(account.pendingBalance)}</b>
            <span className="ep-stellar-panel__network">{STELLAR_NETWORK} network</span>
          </div>
        </div>
        <div className="ep-stellar-panel__actions">
          <button type="button" className="ep-btn-secondary" onClick={() => setModal("receive")}>
            Details
          </button>
          <button type="button" className="ep-btn-primary" onClick={() => setModal("fund")}>
            Fund
          </button>
        </div>
      </header>

      {/* The raw-address route is advanced and error-prone, so it sits here
          rather than competing with Fund. */}
      <div className="ep-stellar-more">
        <div>
          <div className="ep-stellar-more__title">More deposit options</div>
          <div className="ep-stellar-more__body">
            Receive {STELLAR_ASSET} directly from an external wallet on the {STELLAR_NETWORK}{" "}
            network.
          </div>
        </div>
        <button type="button" className="ep-btn-secondary" onClick={() => setModal("receive")}>
          Receive from external wallet →
        </button>
      </div>

      <ActivityList
        title="Recent transactions"
        items={items}
        forceCards={isMobile}
        emptyLabel={activityQuery.isLoading ? "Loading…" : "No transactions yet"}
      />

      {modal ? (
        <div className="ep-modal-overlay" role="presentation" onClick={() => setModal(null)}>
          <div
            className="ep-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ep-stellar-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ep-modal__header">
              <h3 id="ep-stellar-modal-title" className="ep-modal__title">
                {MODAL_TITLE[modal]}
              </h3>
              <button
                type="button"
                className="ep-modal__close"
                aria-label="Close"
                onClick={() => setModal(null)}
              >
                ✕
              </button>
            </div>

            {modal === "fund" ? (
              <FundUsdcAccountModal
                accountName={account.name}
                onPickWalletRoute={() => setModal("wallet-deposit")}
                onClose={() => setModal(null)}
                onCredited={() => activityQuery.refetch()}
              />
            ) : null}

            {modal === "wallet-deposit" ? (
              <ExternalWalletDepositModal
                onClose={() => setModal(null)}
                onCredited={() => activityQuery.refetch()}
              />
            ) : null}

            {modal === "receive" ? (
              <ReceiveExternalWalletModal account={account} onClose={() => setModal(null)} />
            ) : null}

            {modal === "activity" && selected ? (
              <div className="ep-money-stack">
                <div className="ep-txn-detail__hero">
                  <div
                    className="ep-txn-detail__amount ep-mono"
                    style={{
                      color:
                        selected.direction === "in" ? "var(--success)" : "var(--ink)",
                    }}
                  >
                    {presentStellarActivity(selected).amount}
                  </div>
                  <div className="ep-txn-detail__party">{selected.title}</div>
                </div>

                <div className="ep-money-review">
                  {/* Chain-specific rows appear only when the transfer has
                      them — a pending deposit has no hash yet. */}
                  {buildStellarDetailRows(selected).map((row) => (
                    <div className="ep-money-review__row" key={row.label}>
                      <span className="ep-money-review__k">{row.label}</span>
                      <span
                        className={`ep-money-review__v${row.mono ? " ep-money-review__v--mono" : ""}`}
                      >
                        {row.href ? (
                          <a
                            className="ep-stellar-explorer"
                            href={row.href}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {row.value} <span aria-hidden>↗</span>
                          </a>
                        ) : (
                          row.value
                        )}
                      </span>
                    </div>
                  ))}
                </div>

                {isStellarReceiptable(selected.status) ? (
                  <button
                    type="button"
                    className="ep-btn-secondary"
                    onClick={() =>
                      openBrandedDocument(
                        buildStellarReceipt(selected),
                        `mboka-receipt-${selected.id}`,
                      )
                    }
                  >
                    Download receipt
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
