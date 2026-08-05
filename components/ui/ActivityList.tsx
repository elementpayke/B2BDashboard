"use client";

import React from "react";
import StatusBadge from "./StatusBadge";

export type ActivityItem = {
  client: string;
  type: string;
  amount: string;
  amountColor?: string;
  statusLabel: string;
  statusColor: string;
  statusSoft: string;
  flagUrl?: string | null;
  openDetail?: () => void;
  /** Optional secondary line for mobile cards (e.g. date/ref) */
  meta?: string;
};

type Props = {
  title: string;
  items: ActivityItem[];
  onViewAll?: () => void;
  /** When true, always use card layout (for narrow embeds) */
  forceCards?: boolean;
  emptyLabel?: string;
  columns?: "activity" | "transactions";
};

/**
 * Responsive transaction/activity list:
 * - Desktop/tablet (≥640): table-style rows
 * - Mobile (<640): stacked cards with essential fields
 */
export default function ActivityList({
  title,
  items,
  onViewAll,
  forceCards = false,
  emptyLabel = "No activity yet",
  columns = "activity",
}: Props) {
  return (
    <section className="ep-panel ep-activity">
      <div className="ep-activity__header">
        <h2 className="ep-activity__title">{title}</h2>
        {onViewAll ? (
          <button type="button" onClick={onViewAll} className="ep-link-btn">
            View all →
          </button>
        ) : null}
      </div>

      {items.length === 0 ? (
        <div className="ep-activity__empty">{emptyLabel}</div>
      ) : (
        <>
          {/* Desktop / tablet table header */}
          {!forceCards && columns === "transactions" ? (
            <div className="ep-activity__table-head" aria-hidden>
              <span>Counterparty</span>
              <span>Rail</span>
              <span>Status</span>
              <span className="ep-align-end">Amount</span>
            </div>
          ) : null}

          <ul className={`ep-activity__list${forceCards ? " ep-activity__list--cards" : ""}`}>
            {items.map((tx, i) => (
              <li key={i}>
                <button
                  type="button"
                  className="ep-activity__row"
                  onClick={tx.openDetail}
                  disabled={!tx.openDetail}
                  aria-label={`${tx.client}, ${tx.amount}, ${tx.statusLabel}`}
                >
                  {/* Mobile card layout */}
                  <div className="ep-activity__card">
                    <div className="ep-activity__card-top">
                      <div className="ep-activity__party">
                        {tx.flagUrl ? (
                          <span
                            className="ep-flag"
                            style={{ backgroundImage: `url(${tx.flagUrl})` }}
                            aria-hidden
                          />
                        ) : null}
                        <span className="ep-activity__client">{tx.client}</span>
                      </div>
                      <span
                        className="ep-mono ep-activity__amount"
                        style={{ color: tx.amountColor || "var(--ink)" }}
                      >
                        {tx.amount}
                      </span>
                    </div>
                    <div className="ep-activity__card-bottom">
                      <span className="ep-activity__type">{tx.type}</span>
                      {tx.meta ? <span className="ep-activity__meta">{tx.meta}</span> : null}
                      <StatusBadge
                        label={tx.statusLabel}
                        color={tx.statusColor}
                        soft={tx.statusSoft}
                      />
                    </div>
                  </div>

                  {/* Desktop row layout */}
                  <div className="ep-activity__desktop">
                    <div className="ep-activity__party">
                      {tx.flagUrl ? (
                        <span
                          className="ep-flag"
                          style={{ backgroundImage: `url(${tx.flagUrl})` }}
                          aria-hidden
                        />
                      ) : null}
                      <span className="ep-activity__client">{tx.client}</span>
                    </div>
                    <span className="ep-activity__type">{tx.type}</span>
                    <StatusBadge
                      label={tx.statusLabel}
                      color={tx.statusColor}
                      soft={tx.statusSoft}
                    />
                    <span
                      className="ep-mono ep-activity__amount ep-align-end"
                      style={{ color: tx.amountColor || "var(--ink)" }}
                    >
                      {tx.amount}
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
