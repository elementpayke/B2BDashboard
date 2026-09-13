"use client";

import StatusBadge from "@/components/ui/StatusBadge";

export type CardSpendItem = {
  id: string;
  merchant: string;
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

function merchantInitial(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const letter = trimmed.match(/[A-Za-z0-9]/)?.[0];
  return (letter || trimmed[0] || "?").toUpperCase();
}

function avatarTone(name: string): string {
  const tones = [
    "color-mix(in srgb, var(--indigo) 72%, #1a1630)",
    "color-mix(in srgb, var(--ink) 85%, var(--indigo))",
    "color-mix(in srgb, #3d2a1f 80%, var(--amber))",
    "color-mix(in srgb, #1f3d36 75%, var(--success))",
    "color-mix(in srgb, #2a2440 70%, var(--indigo))",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash + name.charCodeAt(i) * (i + 1)) % tones.length;
  }
  return tones[hash] || tones[0];
}

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
            const initial = merchantInitial(tx.merchant);
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
                  <span
                    className="ep-card-spend__avatar"
                    style={{ background: avatarTone(tx.merchant) }}
                    aria-hidden
                  >
                    {initial}
                  </span>
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
