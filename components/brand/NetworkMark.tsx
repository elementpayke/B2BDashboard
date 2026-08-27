"use client";
import React from "react";
import { toPartnerNetwork } from "@/lib/services/entities";

export type NetworkMarkNetwork = "Base" | "Polygon" | "Stellar";

export type NetworkMarkProps = {
  network: string | null | undefined;
  size?: number;
  /** Accessible name; pass null for decorative marks beside visible labels. */
  title?: string | null;
  className?: string;
};

/** Resolve a supported partner network for logo rendering. */
export function partnerNetworkForMark(
  network: string | null | undefined,
): NetworkMarkNetwork | null {
  return toPartnerNetwork(String(network ?? "").trim());
}

function BaseGlyph() {
  // Base brand mark — solid blue disc (Base / Coinbase blue).
  return <circle cx="16" cy="16" r="16" fill="#0052FF" />;
}

function PolygonGlyph() {
  // Simplified Polygon mark on brand purple.
  return (
    <>
      <circle cx="16" cy="16" r="16" fill="#8247E5" />
      <path
        fill="#FFFFFF"
        d="M10.4 12.2 16 9l5.6 3.2v6.4L16 21.8l-5.6-3.2v-6.4zm1.5 1.1v4.2L16 19.9l4.1-2.4v-4.2L16 11.1l-4.1 2.2z"
      />
    </>
  );
}

function StellarGlyph() {
  // Stellar-style star on dark disc.
  return (
    <>
      <circle cx="16" cy="16" r="16" fill="#0A0B0D" />
      <path
        fill="#FFFFFF"
        d="M7.2 16.8c4.4-.4 8.1-1.6 11.1-3.5 3-1.9 5.1-4.3 6.3-7.1.2 1.1.2 2.1 0 3.1-1.1 4.1-3.7 7.3-7.7 9.5-2.7 1.5-5.8 2.4-9.7 2.7v-4.7zm17.6-1.6c-4.4.4-8.1 1.6-11.1 3.5-3 1.9-5.1 4.3-6.3 7.1-.2-1.1-.2-2.1 0-3.1 1.1-4.1 3.7-7.3 7.7-9.5 2.7-1.5 5.8-2.4 9.7-2.7v4.7z"
      />
    </>
  );
}

function glyphFor(network: NetworkMarkNetwork) {
  if (network === "Base") return <BaseGlyph />;
  if (network === "Polygon") return <PolygonGlyph />;
  return <StellarGlyph />;
}

/**
 * Compact Base / Polygon / Stellar marks for home chips and wallet rails.
 * Returns null when the network is unknown so callers can fall back.
 */
export default function NetworkMark({
  network,
  size = 28,
  title,
  className,
}: NetworkMarkProps) {
  const partner = partnerNetworkForMark(network);
  if (!partner) return null;

  const label = title === undefined ? partner : title;
  const decorative = label === null;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      width={size}
      height={size}
      className={`ep-network-mark${className ? ` ${className}` : ""}`}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative || undefined}
      focusable="false"
    >
      {decorative ? null : <title>{label}</title>}
      {glyphFor(partner)}
    </svg>
  );
}
