/**
 * The identity mark for an account: a national flag, a stablecoin's brand
 * mark, or a currency badge.
 *
 * Everything without a flag used to fall through to a single generic ◈, so a
 * USDC account, a USDT account and a West African CFA Franc account were
 * visually indistinguishable.
 *
 * Stablecoins are drawn in their issuers' official brand colours — USDC
 * #2775CA, USDT #26A17B — as a coloured disc carrying the asset's own currency
 * symbol. These are *not* traced copies of the official logotypes: Circle's
 * guidelines require their mark be used unaltered, so approximating it by hand
 * would be worse than not using it. Drop the real SVGs from the issuers' brand
 * portals into `BRAND_MARKS` if exact logotypes are wanted.
 *
 * XOF and XAF deliberately get a badge rather than a flag. They are shared
 * currencies — XOF across 8 UEMOA states, XAF across 6 CEMAC states — so any
 * single national flag would be factually wrong for most holders.
 */

export type AssetMarkKind = "flag" | "stablecoin" | "badge";

type BrandMark = {
  /** Issuer's official brand colour. */
  background: string;
  /** Glyph carried on the disc — the asset's own currency symbol. */
  glyph: string;
  foreground: string;
};

/** Keyed by partner asset code. */
export const BRAND_MARKS: Record<string, BrandMark> = {
  // Circle, USDC brand guide: the token mark is always blue, never inverted.
  USDC: { background: "#2775CA", glyph: "$", foreground: "#FFFFFF" },
  // Tether "Jungle Green" (PMS 7724 C).
  USDT: { background: "#26A17B", glyph: "₮", foreground: "#FFFFFF" },
  // Circle's euro stablecoin shares the USDC palette.
  EURC: { background: "#2775CA", glyph: "€", foreground: "#FFFFFF" },
};

/** Currencies with no single national flag, by design. */
const SHARED_CURRENCY_GLYPHS: Record<string, string> = {
  XOF: "₣",
  XAF: "₣",
};

export function assetMarkKind(code: string, flagUrl: string | null): AssetMarkKind {
  if (flagUrl) return "flag";
  if (BRAND_MARKS[(code || "").trim().toUpperCase()]) return "stablecoin";
  return "badge";
}

export default function AssetMark({
  code,
  flagUrl,
  label,
  className = "ep-wallets__flag",
}: {
  /** Partner asset/currency code, e.g. "USDC", "XOF", "KES". */
  code: string;
  /** Flag image URL when the currency maps to one country; null otherwise. */
  flagUrl?: string | null;
  /** Accessible name. Omit when a sibling already names the account. */
  label?: string;
  className?: string;
}) {
  const upper = (code || "").trim().toUpperCase();
  const brand = BRAND_MARKS[upper];
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

  if (brand) {
    return (
      <span
        className={`${className} ep-wallets__flag--brand`}
        style={{ background: brand.background, color: brand.foreground }}
        {...a11y}
      >
        <span className="ep-wallets__flag-glyph">{brand.glyph}</span>
      </span>
    );
  }

  // Shared-currency or unknown code: show the code itself rather than a glyph
  // that says nothing. Three letters fit the 38px tile; longer codes truncate.
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
