"use client";

import { useState } from "react";

/**
 * Square mark for a card-spend merchant. Uses the enriched brand logo when the
 * backend resolved one; otherwise a deterministic colored initial chip.
 *
 * Mirrors MobileMoneyMark, with one addition: brand logos are remote URLs from
 * the enrichment provider's CDN, and a dead link must degrade to the chip
 * rather than leave a broken-image glyph in a financial list.
 */

const TONES = [
  "color-mix(in srgb, var(--indigo) 72%, #1a1630)",
  "color-mix(in srgb, var(--ink) 85%, var(--indigo))",
  "color-mix(in srgb, #3d2a1f 80%, var(--amber))",
  "color-mix(in srgb, #1f3d36 75%, var(--success))",
  "color-mix(in srgb, #2a2440 70%, var(--indigo))",
];

export function merchantInitial(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const letter = trimmed.match(/[A-Za-z0-9]/)?.[0];
  return (letter || trimmed[0] || "?").toUpperCase();
}

/** Stable per-merchant tone so a name keeps its colour across renders. */
export function avatarTone(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash + name.charCodeAt(i) * (i + 1)) % TONES.length;
  }
  return TONES[hash] || TONES[0];
}

type Props = {
  /** Display name; also drives the fallback initial and tone. */
  name: string;
  /** Enriched brand logo, when one was resolved. */
  logoUrl?: string | null;
  size?: number;
  /**
   * Layout class from the host list (grid placement, size). Applied to *both*
   * branches — the logo and the chip occupy the same slot, so it can't be an
   * either/or with the component's own state classes.
   */
  className?: string;
};

export default function MerchantMark({
  name,
  logoUrl,
  size = 36,
  className = "ep-merchant-mark",
}: Props) {
  const [failed, setFailed] = useState(false);
  const src = logoUrl?.trim() || "";
  const showLogo = Boolean(src) && !failed;

  if (showLogo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- remote brand CDN, no loader needed
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        className={`${className} ep-merchant-mark--logo`}
        style={{ width: size, height: size }}
        onError={() => setFailed(true)}
        loading="lazy"
        draggable={false}
      />
    );
  }

  return (
    <span
      className={`${className} ep-merchant-mark--fallback`}
      style={{ width: size, height: size, background: avatarTone(name) }}
      aria-hidden
    >
      {merchantInitial(name)}
    </span>
  );
}
