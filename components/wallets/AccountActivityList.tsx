"use client";
import React from "react";
import { useAccountActivityPage } from "@/lib/hooks/useAccountActivityPage";
import { formatTransactionDate } from "@/lib/services/transactionPresentation";

/**
 * Account lifecycle audit trail (account opened, bank details issued, ...),
 * sourced from Mboka's own `/v1/iban/accounts/{id}/activity` once it ships —
 * that endpoint doesn't exist on most backends yet, so an error or missing
 * `accountId` both degrade to rendering nothing rather than a scary error
 * banner for what is purely an optional enhancement.
 */
export default function AccountActivityList({
  accountId,
}: {
  accountId?: string | null;
}) {
  const { entries, isLoading, isError, hasNext, hasPrev, nextPage, prevPage } =
    useAccountActivityPage(accountId);

  if (!accountId || isError) return null;

  return (
    <div className="ep-wallets-detail__section">
      <div className="ep-wallets-detail__section-title">Activity</div>
      {isLoading ? (
        <p className="ep-wallets-detail__pending-body" role="status">
          Loading activity…
        </p>
      ) : entries.length === 0 ? (
        <p className="ep-wallets-detail__pending-body">No activity yet.</p>
      ) : (
        <div className="ep-wallets-detail__rows" aria-label="Activity">
          {entries.map((entry, i) => (
            <div
              className="ep-wallets-detail__row"
              key={`${entry.event_type}-${entry.occurred_at}-${i}`}
            >
              <span className="ep-wallets-detail__label">{entry.label}</span>
              <span className="ep-wallets-detail__value">
                {formatTransactionDate(entry.occurred_at)}
              </span>
            </div>
          ))}
        </div>
      )}
      {hasPrev || hasNext ? (
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button
            type="button"
            className="ep-wallets-detail__letter"
            onClick={prevPage}
            disabled={!hasPrev}
            style={{ flex: 1 }}
          >
            Newer
          </button>
          <button
            type="button"
            className="ep-wallets-detail__letter"
            onClick={nextPage}
            disabled={!hasNext}
            style={{ flex: 1 }}
          >
            Older
          </button>
        </div>
      ) : null}
    </div>
  );
}
