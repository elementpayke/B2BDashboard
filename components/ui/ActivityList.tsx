"use client";

import React from "react";
import StatusBadge from "./StatusBadge";

export type ActivityItem = {
  id?: string | number;
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
  /** Hide the panel title row (e.g. when the screen shell already titles the page) */
  showHeader?: boolean;
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
  showHeader = true,
}: Props) {
  return (
    <section className="ep-panel ep-activity" aria-label={title}>
      {showHeader ? (
        <div className="ep-activity__header">
          <h2 className="ep-activity__title">{title}</h2>
          {onViewAll ? (
            <button type="button" onClick={onViewAll} className="ep-link-btn">
              See All
            </button>
          ) : null}
        </div>
      ) : null}

      {items.length === 0 ? (
        <div className="ep-activity__empty">{emptyLabel}</div>
      ) : (
        <>
          {!forceCards && columns === "transactions" ? (
            <div className="ep-activity__table-head" aria-hidden>
              <span>Counterparty</span>
              <span>Rail</span>
              <span>Status</span>
              <span className="ep-align-end">Amount</span>
            </div>
          ) : null}

          <ul className={`ep-activity__list${forceCards ? " ep-activity__list--cards" : ""}`}>
            {items.map((tx, i) => {
              const key = tx.id != null ? String(tx.id) : `${tx.client}-${tx.amount}-${i}`;
              return (
                <li key={key}>
                  <button
                    type="button"
                    className="ep-activity__row"
                    onClick={tx.openDetail}
                    disabled={!tx.openDetail}
                    aria-label={`${tx.client}, ${tx.type}, ${tx.amount}, ${tx.statusLabel}`}
                  >
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
                          <div className="ep-activity__party-text">
                            <span className="ep-activity__client">{tx.client}</span>
                            {tx.meta ? (
                              <span className="ep-activity__meta">{tx.meta}</span>
                            ) : null}
                          </div>
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
                        <StatusBadge
                          label={tx.statusLabel}
                          color={tx.statusColor}
                          soft={tx.statusSoft}
                        />
                      </div>
                    </div>

                    <div className="ep-activity__desktop">
                      <div className="ep-activity__party">
                        {tx.flagUrl ? (
                          <span
                            className="ep-flag"
                            style={{ backgroundImage: `url(${tx.flagUrl})` }}
                            aria-hidden
                          />
                        ) : null}
                        <div className="ep-activity__party-text">
                          <span className="ep-activity__client">{tx.client}</span>
                          {tx.meta ? (
                            <span className="ep-activity__meta">{tx.meta}</span>
                          ) : null}
                        </div>
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
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
