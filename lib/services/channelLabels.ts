/**
 * Customer-facing channel labels. Aggregator / institution brands (Yellowcard,
 * M-Pesa, partner banks) stay internal for routing (`networkId`, catalog ids)
 * and must not headline the dashboard.
 */

export type RailKind = "mobile" | "bank" | "crypto" | string;

const AGGREGATOR_SLUGS = new Set([
  "yellowcard",
  "yellow card",
  "yc",
  "modulr",
  "clearbank",
  "circle",
]);

/** Rail-level label used across deposit / send / activity. */
export function channelLabelForRail(railType: RailKind | undefined | null): string {
  const type = (railType || "").toLowerCase();
  if (type === "mobile" || type === "momo") return "Mobile money";
  if (type === "bank") return "Bank transfer";
  if (type === "crypto") return "Stablecoin";
  return "Local transfer";
}

/**
 * True when a provider string is an aggregator slug or otherwise unsafe to
 * show as a counterparty title (e.g. order.provider = "yellowcard").
 */
export function isInternalProviderName(value: string | null | undefined): boolean {
  const raw = value?.trim();
  if (!raw) return true;
  const normalized = raw.toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  if (AGGREGATOR_SLUGS.has(normalized)) return true;
  // Single-token lowercase slugs from aggregators (no spaces, no digits).
  if (/^[a-z]+$/.test(normalized) && normalized.length <= 16) return true;
  return false;
}

/**
 * Prefer a human workflow title over raw provider / aggregator names.
 * Example: "yellowcard" → "Deposit · KES".
 *
 * Partner / institution brands are never used as the list title — they confuse
 * merchants about who they are transacting with.
 */
export function transactionPartyLabel(input: {
  direction: "in" | "out" | "unknown" | string;
  currency: string;
  provider?: string | null;
}): string {
  const kind =
    input.direction === "in" ? "Deposit" : input.direction === "out" ? "Payout" : "Transaction";
  const currency = (input.currency || "").toUpperCase() || "—";
  void input.provider;
  return `${kind} · ${currency}`;
}

/**
 * Soften catalog display names for chips / summaries while keeping the raw
 * name for `networkIdForProvider` lookups.
 */
export function displayChannelName(
  railType: RailKind | undefined | null,
  providerName: string | null | undefined,
): string {
  const rail = channelLabelForRail(railType);
  const name = providerName?.trim();
  if (!name) return rail;

  const lower = name.toLowerCase();
  if (isInternalProviderName(name)) return rail;
  if (/\bm-?pesa\b|\bairtel\b|\bmtn\b|\bmomo\b|\bopay\b|\bpalmpay\b|\btigo\b/.test(lower)) {
    return railType === "bank" ? rail : "Mobile money";
  }
  if (/\bbank\b|\beft\b|\bsepa\b|\bach\b|\bswift\b|\biban\b/.test(lower)) {
    return "Bank transfer";
  }
  // Institution legal names (NATIONAL BANK OF KENYA, NCBA Bank, …) → rail label.
  if (railType === "bank" || railType === "mobile" || railType === "momo") {
    return rail;
  }
  return rail;
}
