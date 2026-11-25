"use client";
import React from "react";
import CoinMark, { isCoinMarkAsset } from "@/components/brand/CoinMark";
import NetworkMark, { partnerNetworkForMark } from "@/components/brand/NetworkMark";

/**
 * The identity mark for an account: a national flag, a stablecoin's brand coin
 * (optionally badged with the chain it settles on), or a currency badge.
 *
 * Everything without a flag used to fall through to a single generic ◈, so a
 * USDC-on-Stellar account, a USDT-on-Polygon account and a West African CFA
 * Franc account were visually indistinguishable.
 *
 * Marks come from the assets the app already ships — `CoinMark` for the
 * issuers' coins, `NetworkMark` for the Base/Polygon/Stellar brand art in
 * `public/brand` — rather than anything drawn here, so the dashboard, the
 * landing page and the network chips all render the same artwork.
 *
 * XOF and XAF deliberately get a badge, not a flag. They are shared currencies
 * — XOF across 8 UEMOA states, XAF across 6 CEMAC states — so any single
 * national flag would be wrong for most holders.
 */

export type AssetMarkKind = "flag" | "coin" | "badge";

/** Currencies with no single national flag, by design. */
const SHARED_CURRENCY_GLYPHS: Record<string, string> = {
  XOF: "₣",
  XAF: "₣",
};

export function assetMarkKind(code: string, flagUrl: string | null): AssetMarkKind {
  if (flagUrl) return "flag";
  if (isCoinMarkAsset(code)) return "coin";
  return "badge";
}

export default function AssetMark({
  code,
  flagUrl,
  network,
  label,
  className = "ep-wallets__flag",
  coinSize = 38,
}: {
  /** Partner asset/currency code, e.g. "USDC", "XOF", "KES". */
  code: string;
  /** Flag image URL when the currency maps to one country; null otherwise. */
  flagUrl?: string | null;
  /** Settlement chain, badged onto the coin when it has brand art. */
  network?: string | null;
  /** Accessible name. Omit when a sibling already names the account. */
  label?: string;
  className?: string;
  coinSize?: number;
}) {
  const upper = (code || "").trim().toUpperCase();
  const a11y = label ? { role: "img", "aria-label": label } : { "aria-hidden": true };

  if (flagUrl) {
    return (
      <span className={className} {...a11y}>
        <span
          className="ep-wallets__flag-img"
          style={{ backgroundImage: `url(${flagUrl})` }}
        />
      </span>
    );
  }

  if (isCoinMarkAsset(upper)) {
    // The chain badge only renders for networks with real brand art; an
    // unknown chain shows the bare coin rather than a lettered stand-in,
    // which would read as part of the asset's own identity.
    const chain = partnerNetworkForMark(network);
    return (
      <span className={`${className} ep-wallets__flag--coin`} {...a11y}>
        <CoinMark asset={upper} size={coinSize} title={null} />
        {chain ? (
          <span className="ep-wallets__flag-chain">
            {/* ~38% of the coin: big enough to identify the chain, small
                enough that it reads as a badge rather than obscuring the
                asset it sits on. */}
            <NetworkMark network={chain} size={Math.round(coinSize * 0.38)} title={null} />
          </span>
        ) : null}
      </span>
    );
  }

  // Shared-currency or unknown code: show the code itself rather than a glyph
  // that says nothing. Three letters fit the tile; longer codes truncate.
  const glyph = SHARED_CURRENCY_GLYPHS[upper];
  return (
    <span className={className} {...a11y}>
      <span
        className={
          glyph ? "ep-wallets__flag-glyph" : "ep-wallets__flag-glyph ep-wallets__flag-code"
        }
      >
        {glyph ?? (upper.slice(0, 3) || "—")}
      </span>
    </span>
  );
}
