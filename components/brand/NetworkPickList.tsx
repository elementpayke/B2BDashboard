"use client";
import React from "react";
import { NetworkListIcon } from "@/components/brand/NetworkMark";

export type NetworkPickItem = {
  key: string;
  label: string;
  select: () => void;
  selected?: boolean;
};

/**
 * Binance-style "Choose Network" list: icon + name + code per row, reusing
 * the app's existing .ep-pick-row pattern instead of the compact pill chips.
 */
export default function NetworkPickList({
  items,
  ariaLabel,
}: {
  items: NetworkPickItem[];
  ariaLabel: string;
}) {
  return (
    <div className="ep-pick-list" role="listbox" aria-label={ariaLabel}>
      {items.map((n) => (
        <button
          key={n.key}
          type="button"
          role="option"
          aria-selected={Boolean(n.selected)}
          className={`ep-pick-row${n.selected ? " ep-pick-row--selected" : ""}`}
          onClick={n.select}
        >
          <span className="ep-pick-row__mark" aria-hidden>
            <NetworkListIcon network={n.key} label={n.label} />
          </span>
          <span className="ep-pick-row__text">
            <span className="ep-pick-row__title">{n.label}</span>
          </span>
          <span className="ep-pick-row__code">{n.key.toUpperCase()}</span>
          {n.selected ? (
            <span className="ep-pick-row__check" aria-hidden>
              ✓
            </span>
          ) : (
            <span className="ep-pick-row__chev" aria-hidden>
              ›
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
