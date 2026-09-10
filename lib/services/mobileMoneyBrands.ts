/**
 * Mobile-money operator brands for deposit / payout pickers.
 *
 * Catalog names vary ("Mobile Wallet (M-PESA)", "M PESA", "Airtel Money").
 * We normalize to a short label + mark for selection and step summaries.
 */

export type MobileMoneyBrandKey =
  | "mpesa"
  | "airtel"
  | "mtn"
  | "orange"
  | "tigo"
  | "opay"
  | "palmpay"
  | "moov"
  | "vodafone"
  | "generic";

export type MobileMoneyBrand = {
  key: MobileMoneyBrandKey;
  /** Short customer-facing label (e.g. "M-Pesa"). */
  label: string;
  /** Mark under /public/brand/mobile/. */
  logoSrc: string;
  /** Accent for mark fallback chip. */
  accent: string;
};

const BRANDS: Record<Exclude<MobileMoneyBrandKey, "generic">, MobileMoneyBrand> = {
  mpesa: {
    key: "mpesa",
    label: "M-Pesa",
    logoSrc: "/brand/mobile/mpesa.svg",
    accent: "#00A651",
  },
  airtel: {
    key: "airtel",
    label: "Airtel Money",
    logoSrc: "/brand/mobile/airtel.svg",
    accent: "#ED1C24",
  },
  mtn: {
    key: "mtn",
    label: "MTN MoMo",
    logoSrc: "/brand/mobile/mtn.svg",
    accent: "#FFCC00",
  },
  orange: {
    key: "orange",
    label: "Orange Money",
    logoSrc: "/brand/mobile/orange.svg",
    accent: "#FF7900",
  },
  tigo: {
    key: "tigo",
    label: "Tigo Pesa",
    logoSrc: "/brand/mobile/tigo.svg",
    accent: "#00377D",
  },
  opay: {
    key: "opay",
    label: "OPay",
    logoSrc: "/brand/mobile/opay.svg",
    accent: "#1DCF9A",
  },
  palmpay: {
    key: "palmpay",
    label: "PalmPay",
    logoSrc: "/brand/mobile/palmpay.svg",
    accent: "#6C2BD9",
  },
  moov: {
    key: "moov",
    label: "Moov Money",
    logoSrc: "/brand/mobile/moov.svg",
    accent: "#00A0E3",
  },
  vodafone: {
    key: "vodafone",
    label: "Vodafone Cash",
    logoSrc: "/brand/mobile/vodafone.svg",
    accent: "#E60000",
  },
};

const GENERIC: MobileMoneyBrand = {
  key: "generic",
  label: "Mobile money",
  logoSrc: "/brand/mobile/generic.svg",
  accent: "#5B5BD6",
};

function normalizeProviderToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/[()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Compact form for catalog codes like AIRTELMONEYTZ / MPESATZ (no separators).
 */
function compactProviderToken(value: string): string {
  return normalizeProviderToken(value).replace(/\s+/g, "");
}

/**
 * Map a catalog provider name/code to a known mobile-money brand.
 * Returns null when the string does not look like a mobile-money operator
 * (e.g. a bank legal name) so callers can fall back to rail labels.
 */
export function resolveMobileMoneyBrand(
  providerName: string | null | undefined,
): MobileMoneyBrand | null {
  const raw = providerName?.trim();
  if (!raw) return null;
  const n = normalizeProviderToken(raw);
  const c = compactProviderToken(raw);

  // Prefer compact catalog codes (AIRTELMONEYTZ) then spaced display names.
  if (/mpesa|safaricom/.test(c) || /\bm\s*pesa\b|\bsafaricom\b/.test(n)) {
    return BRANDS.mpesa;
  }
  if (/airtel/.test(c) || /\bairtel\b/.test(n)) return BRANDS.airtel;
  if ((/mtn|momo/.test(c) || /\bmtn\b|\bmomo\b/.test(n)) && !/moov/.test(c)) {
    return BRANDS.mtn;
  }
  if (/orange/.test(c) || /\borange\b/.test(n)) return BRANDS.orange;
  if (/tigo/.test(c) || /\btigo\b/.test(n)) return BRANDS.tigo;
  if (/opay/.test(c) || /\bopay\b/.test(n)) return BRANDS.opay;
  if (/palmpay/.test(c) || /\bpalmpay\b|\bpalm pay\b/.test(n)) return BRANDS.palmpay;
  if (/moov/.test(c) || /\bmoov\b/.test(n)) return BRANDS.moov;
  if (/vodafone|^voda/.test(c) || /\bvodafone\b|\bvoda\b/.test(n)) {
    return BRANDS.vodafone;
  }
  if (/\bmobile\b|\bwallet\b/.test(n) || /mobile|wallet/.test(c)) {
    return { ...GENERIC, label: shortenGenericLabel(raw) };
  }
  return null;
}

function shortenGenericLabel(raw: string): string {
  const cleaned = raw
    .replace(/mobile\s*wallet\s*/i, "")
    .replace(/[()]/g, "")
    .trim();
  return cleaned || "Mobile money";
}

/** Short label for summaries / pickers; falls back to the raw catalog name. */
export function mobileMoneyDisplayLabel(
  providerName: string | null | undefined,
): string {
  const brand = resolveMobileMoneyBrand(providerName);
  if (brand && brand.key !== "generic") return brand.label;
  if (brand) return brand.label;
  const raw = providerName?.trim();
  return raw || "Mobile money";
}

export function isMobileMoneyRail(railType: string | null | undefined): boolean {
  const t = (railType || "").toLowerCase();
  return t === "mobile" || t === "momo";
}
