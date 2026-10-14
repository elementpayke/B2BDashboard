"use client";

import { useRef, type KeyboardEvent } from "react";
import { CARD_COLORS, type CardColorKey } from "@/lib/services/cardColors";

type Props = {
  value: CardColorKey;
  onChange: (key: CardColorKey) => void;
  disabled?: boolean;
};

/**
 * Round colour swatches for choosing a card's colour at issue time.
 * A radio group: one tab stop, arrow keys move and select, like native radios.
 */
export default function CardColorPicker({ value, onChange, disabled }: Props) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const index = Math.max(
    0,
    CARD_COLORS.findIndex((c) => c.key === value),
  );

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step =
      e.key === "ArrowRight" || e.key === "ArrowDown"
        ? 1
        : e.key === "ArrowLeft" || e.key === "ArrowUp"
          ? -1
          : 0;
    if (!step) return;
    e.preventDefault();
    const next = (index + step + CARD_COLORS.length) % CARD_COLORS.length;
    onChange(CARD_COLORS[next].key);
    refs.current[next]?.focus();
  };

  return (
    <div
      className="ep-card-swatches"
      role="radiogroup"
      aria-label="Card colour"
      aria-disabled={disabled || undefined}
      onKeyDown={disabled ? undefined : onKeyDown}
    >
      {CARD_COLORS.map((c, i) => {
        const selected = c.key === value;
        return (
          <button
            key={c.key}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={c.name}
            title={c.name}
            tabIndex={selected ? 0 : -1}
            disabled={disabled}
            className="ep-card-swatches__swatch"
            style={{ background: c.bg }}
            onClick={() => onChange(c.key)}
          />
        );
      })}
    </div>
  );
}
