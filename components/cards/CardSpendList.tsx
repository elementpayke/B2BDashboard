"use client";

import MerchantMark from "@/components/money/MerchantMark";
import StatusBadge from "@/components/ui/StatusBadge";

export type CardSpendItem = {
  id: string;
  merchant: string;
  /** Enriched brand logo when the backend resolved one for this descriptor. */
  merchantLogoUrl?: string | null;
  meta: string;
  cardLast4: string;
  statusLabel: string;
  statusColor: string;
  statusSoft: string;
  amount: string;
  amountColor?: string;
  openDetail?: () => void;
};

type Props = {
  title?: string;
  items: CardSpendItem[];
  onViewAll?: () => void;
  emptyLabel?: string;
};

export default function CardSpendList({
  title = "Card spend",
  items,
  onViewAll,
  emptyLabel = "No card spend yet.",
}: Props) {
  return (
    <section className="ep-panel ep-card-spend" aria-label={title}>
      <div className="ep-card-spend__header">
        <h2 className="ep-card-spend__title">{title}</h2>
        {onViewAll ? (
          <button type="button" onClick={onViewAll} className="ep-link-btn">
            View all →
          </button>
        ) : null}
      </div>

      {items.length === 0 ? (
        <div className="ep-card-spend__empty">{emptyLabel}</div>
      ) : (
        <ul className="ep-card-spend__list">
          {items.map((tx) => {
            return (
              <li key={tx.id}>
                <button
                  type="button"
                  className="ep-card-spend__row"
                  onClick={tx.openDetail}
                  disabled={!tx.openDetail}
                  aria-label={[
                    tx.merchant,
                    tx.meta,
                    tx.cardLast4,
                    tx.amount,
                    tx.statusLabel,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                >
                  <MerchantMark
                    name={tx.merchant}
                    logoUrl={tx.merchantLogoUrl}
                    className="ep-card-spend__avatar"
                  />
                  <div className="ep-card-spend__party">
                    <span className="ep-card-spend__merchant">{tx.merchant}</span>
                    <span className="ep-card-spend__meta">{tx.meta}</span>
                  </div>
                  {tx.cardLast4 ? (
                    <span className="ep-card-spend__last4">{tx.cardLast4}</span>
                  ) : (
                    <span className="ep-card-spend__last4" aria-hidden />
                  )}
                  <StatusBadge
                    label={tx.statusLabel}
                    color={tx.statusColor}
                    soft={tx.statusSoft}
                  />
                  <span
                    className="ep-mono ep-card-spend__amount"
                    style={{ color: tx.amountColor || "var(--ink)" }}
                  >
                    {tx.amount}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
