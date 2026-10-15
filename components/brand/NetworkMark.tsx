"use client";
import React, { useId } from "react";
import { toPartnerNetwork } from "@/lib/services/entities";

export type NetworkMarkNetwork = "Base" | "Polygon" | "Stellar";

export type NetworkMarkProps = {
  network: string | null | undefined;
  size?: number;
  /** Accessible name; pass null for decorative marks beside visible labels. */
  title?: string | null;
  className?: string;
};

const BRAND_MARKS: Record<
  NetworkMarkNetwork,
  { src: string; plate: string; fit: "cover" | "contain"; pad: number }
> = {
  Base: {
    src: "/brand/base-mark.png",
    plate: "#0052FF",
    fit: "cover",
    pad: 0,
  },
  Polygon: {
    src: "/brand/polygon-mark.png",
    plate: "#FFFFFF",
    fit: "contain",
    pad: 4,
  },
  Stellar: {
    src: "/brand/stellar-mark.png",
    plate: "#000000",
    fit: "contain",
    pad: 4,
  },
};

/** Resolve a network that has a brand mark asset (subset of PartnerNetwork). */
export function partnerNetworkForMark(
  network: string | null | undefined,
): NetworkMarkNetwork | null {
  const partner = toPartnerNetwork(String(network ?? "").trim());
  if (partner === "Base" || partner === "Polygon" || partner === "Stellar") {
    return partner;
  }
  return null;
}

function BrandGlyph({
  network,
  clipId,
}: {
  network: NetworkMarkNetwork;
  clipId: string;
}) {
  const mark = BRAND_MARKS[network];
  const inset = mark.pad;
  const size = 32 - inset * 2;

  return (
    <>
      <defs>
        <clipPath id={clipId}>
          <circle cx="16" cy="16" r="16" />
        </clipPath>
      </defs>
      <circle cx="16" cy="16" r="16" fill={mark.plate} />
      <image
        href={mark.src}
        x={inset}
        y={inset}
        width={size}
        height={size}
        preserveAspectRatio={
          mark.fit === "cover" ? "xMidYMid slice" : "xMidYMid meet"
        }
        clipPath={`url(#${clipId})`}
      />
    </>
  );
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
  const clipId = useId().replace(/:/g, "");
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
      <BrandGlyph network={partner} clipId={clipId} />
    </svg>
  );
}

/**
 * Network icon for list rows: a brand mark when one exists (Base/Polygon/
 * Stellar), otherwise a lettered avatar so Ethereum/Optimism/Arbitrum still
 * get a consistent row treatment instead of a blank slot.
 */
export function NetworkListIcon({
  network,
  label,
  size = 32,
}: {
  network: string | null | undefined;
  label: string;
  size?: number;
}) {
  const mark = <NetworkMark network={network} size={size} title={null} />;
  if (partnerNetworkForMark(network)) return mark;
  return (
    <span
      className="ep-home__balance-row-avatar"
      aria-hidden
      style={{ width: size, height: size }}
    >
      {label.slice(0, 2).toUpperCase()}
    </span>
  );
}
