"use client";

import type { LiveRateRow } from "@/lib/services/dashboard";

type RatesMarqueeProps = {
  rates: LiveRateRow[];
};

/** Horizontal FX strip — duplicates the row for a CSS marquee loop. */
export default function RatesMarquee({ rates }: RatesMarqueeProps) {
  if (!rates.length) return null;
  const track = [...rates, ...rates];

  return (
    <div className="ep-rates-marquee" aria-label="Live exchange rates">
      <div className="ep-rates-marquee__track">
        {track.map((row, i) => (
          <span key={`${row.pair}-${i}`} className="ep-rates-marquee__item">
            <span className="ep-rates-marquee__pair">{row.pair.replace("/", " / ")}</span>
            <span className="ep-rates-marquee__value">{row.value}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
