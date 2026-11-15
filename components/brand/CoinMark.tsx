"use client";
import React from "react";

/**
 * Stablecoin brand marks.
 *
 * These are the same vectors the landing page uses — Tether's ₮-through-ellipse
 * on #26A17B, Circle's twin arcs and $ on #2775CA — lifted here so the product
 * UI and the marketing site draw the identical mark. `landingPrimitives`
 * re-exports from this module so there is one definition, not two that can
 * drift apart.
 */

export type CoinMarkAsset = "USDC" | "USDT" | "EURC";

export function isCoinMarkAsset(code: string | null | undefined): code is CoinMarkAsset {
  const upper = String(code ?? "").trim().toUpperCase();
  return upper === "USDC" || upper === "USDT" || upper === "EURC";
}

function UsdtGlyph() {
  return (
    <>
      <circle cx="50" cy="50" r="50" fill="#26A17B" />
      <path
        d="M27 26H73V37H56V45C68 46 76 49 76 52.5C76 56 68 59 56 60V78H44V60C32 59 24 56 24 52.5C24 49 32 46 44 45V37H27Z"
        fill="#FFFFFF"
      />
      <ellipse cx="50" cy="52.5" rx="21" ry="4.2" fill="#26A17B" />
    </>
  );
}

function CircleGlyph({ symbol }: { symbol: string }) {
  return (
    <>
      <circle cx="50" cy="50" r="50" fill="#2775CA" />
      <path
        d="M38 22a30 30 0 0 0 0 56M62 22a30 30 0 0 1 0 56"
        stroke="#FFFFFF"
        strokeWidth="5"
        fill="none"
        strokeLinecap="round"
      />
      <text
        x="50"
        y="64"
        textAnchor="middle"
        fontFamily="Space Grotesk,sans-serif"
        fontWeight={700}
        fontSize="40"
        fill="#FFFFFF"
      >
        {symbol}
      </text>
    </>
  );
}

export default function CoinMark({
  asset,
  size = 28,
  title,
  className,
}: {
  asset: CoinMarkAsset;
  /** Pixels, or any CSS length — the landing page sizes these as "1em". */
  size?: number | string;
  /** Accessible name; pass null beside an existing visible label. */
  title?: string | null;
  className?: string;
}) {
  const label = title === undefined ? asset : title;
  const decorative = label === null;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative || undefined}
      focusable="false"
      style={{ display: "block", flexShrink: 0 }}
    >
      {decorative ? null : <title>{label}</title>}
      {asset === "USDT" ? <UsdtGlyph /> : <CircleGlyph symbol={asset === "EURC" ? "€" : "$"} />}
    </svg>
  );
}
