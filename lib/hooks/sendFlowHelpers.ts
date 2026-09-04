/**
 * Thin pure helpers for the Send modal UI.
 * Track 0: extraction only — no new backend wiring.
 */

export type SendDestinationInput = {
  sendGroup: string;
  sendAsset: string;
  sendChainLabel: string;
  countryName: string;
  /** Brand-neutral channel label (e.g. "Mobile money"), never a partner name. */
  channelLabel: string;
};

/** Summary line shown on send steps 2–3 for the chosen destination. */
export function buildSendDestinationSummary(input: SendDestinationInput): string {
  if (input.sendGroup === "crypto") {
    return `${input.sendAsset.toUpperCase()} · ${input.sendChainLabel}`;
  }
  return `${input.countryName} · ${input.channelLabel}`;
}

export function buildSendStepDots(sendStep: number, total = 3): { on: boolean }[] {
  return Array.from({ length: total }, (_, i) => ({ on: i + 1 <= sendStep }));
}

/**
 * Whether this corridor can actually be quoted.
 *
 * Both country rails require `destination.networkId` — the aggregator's
 * institution id, which only comes from `GET /v1/supported/catalog`. The
 * backend rejects the quote on its own validation without it
 * ("payment_method.network_id is required for this rail"), for `bank` and
 * `momo` account types alike, so when the catalog is unavailable there is no
 * payload that can succeed.
 *
 * `providerNamesFromCatalog` returns only live catalog names — never a
 * hardcoded standby list — so when the catalog is unavailable there is no
 * provider chip that can carry an id.
 */
export function sendRailBlockedByMissingNetworkId(input: {
  sendGroup: string;
  /** Result of networkIdForProvider for the selected provider. */
  networkId: string | undefined;
  /** False while the first catalog fetch is still in flight. */
  catalogSettled: boolean;
}): boolean {
  if (input.sendGroup !== "country") return false;
  if (!input.catalogSettled) return false;
  return !input.networkId;
}

/**
 * Human copy for the quote failures whose raw backend message is a field
 * path or an internal integration detail. Prefer a useful upstream message
 * from `data.upstream` when Mboka only wraps it as
 * "Aggregator returned 400 for /partner/orders/quote".
 */
export type SendQuoteErrorData = {
  upstream?: unknown;
  field?: string;
  code?: string;
  message?: string;
  [key: string]: unknown;
};

function isInternalIntegrationMessage(message: string): boolean {
  return (
    /aggregator returned\s+\d+/i.test(message) ||
    /\/partner\//i.test(message) ||
    /upstream request (timed out|failed)/i.test(message) ||
    /^HTTP\s+\d+$/i.test(message.trim())
  );
}

function extractUpstreamMessage(data: SendQuoteErrorData | null | undefined): string | null {
  if (!data || typeof data !== "object") return null;
  const upstream = data.upstream;
  if (!upstream || typeof upstream !== "object") return null;
  const body = upstream as Record<string, unknown>;
  const direct = body.message ?? body.error ?? body.detail;
  if (typeof direct === "string" && direct.trim()) return direct.trim();
  const nested = body.data;
  if (nested && typeof nested === "object") {
    const nestedMsg = (nested as Record<string, unknown>).message;
    if (typeof nestedMsg === "string" && nestedMsg.trim()) return nestedMsg.trim();
  }
  return null;
}

function humanizeQuoteDetail(message: string): string | null {
  if (/insufficient/i.test(message)) {
    return "Insufficient funds to price this payout. Top up your wallet and try again.";
  }
  if (/below.{0,24}min|minimum\s+amount|min(?:imum)?\s+(?:send|transfer|amount)|amount too small/i.test(message)) {
    return "Amount too small for this corridor. Increase the amount and try again.";
  }
  if (/above.?max|maximum\s+amount|amount too (?:large|high)|limit exceeded/i.test(message)) {
    return "Amount too large for this corridor. Lower the amount and try again.";
  }
  if (/invalid.*account|account.*(invalid|not found|does not exist)|unknown account/i.test(message)) {
    return "That recipient account number doesn't look valid for the selected bank. Check it and try again.";
  }
  if (/invalid.*phone|phone.*(invalid|not found)|msisdn/i.test(message)) {
    return "That phone number isn't valid for this corridor. Check the number and try again.";
  }
  if (/network.?id|payment_method/i.test(message)) {
    return "This corridor can't be priced right now — our provider list is unavailable, so we can't route the payment. Please try again shortly.";
  }
  if (/customer\.name|first and last name|recipient name/i.test(message)) {
    return "Enter the account holder's full name (first and last), then try again.";
  }
  if (/additional.?id|nigeria additional/i.test(message)) {
    return "This Nigeria payout needs extra ID details we don't collect yet. Try another corridor or contact support.";
  }
  if (/rate|fx|price|pricing|quote/i.test(message) && /unavail|unable|fail|error/i.test(message)) {
    return "We couldn't lock a rate for this corridor right now. Please try again shortly.";
  }
  return null;
}

export function friendlySendQuoteError(
  message: string,
  data?: SendQuoteErrorData | null,
  status?: number,
): string {
  const upstreamMsg = extractUpstreamMessage(data);
  const candidates = [upstreamMsg, message].filter(
    (m): m is string => typeof m === "string" && m.trim().length > 0,
  );

  for (const candidate of candidates) {
    if (/network_id is required/i.test(candidate)) {
      return "This corridor can't be priced right now — our provider list is unavailable, so we can't route the payment. Please try again shortly.";
    }
    if (/invalid or revoked api key|aggregator returned 401/i.test(candidate)) {
      return "Payouts are temporarily unavailable — our payment partner rejected the connection. This is on us, not your details.";
    }
    const humanized = humanizeQuoteDetail(candidate);
    if (humanized) return humanized;
  }

  // Prefer a concrete upstream reason when it isn't an internal path/status string.
  if (upstreamMsg && !isInternalIntegrationMessage(upstreamMsg)) {
    return upstreamMsg;
  }

  if (
    status === 401 ||
    /aggregator returned 401/i.test(message) ||
    /invalid or revoked api key/i.test(message)
  ) {
    return "Payouts are temporarily unavailable — our payment partner rejected the connection. This is on us, not your details.";
  }
  if (status === 504 || /aggregator timed out|upstream request timed out|aggregator returned 504/i.test(message)) {
    return "Pricing timed out — our payment partner took too long to respond. Please try again in a moment.";
  }
  if (
    status === 502 ||
    status === 503 ||
    /aggregator returned 50[23]|upstream request failed|aggregator transport|aggregator is not configured/i.test(
      message,
    )
  ) {
    return "Payouts are temporarily unavailable — our payment partner is having trouble. Please try again shortly.";
  }
  if (status === 422 || /aggregator returned 422/i.test(message)) {
    return "Some payout details need fixing before we can quote. Check the recipient, bank, and amount, then try again.";
  }
  if (status === 400 || /aggregator returned 400/i.test(message)) {
    return "We couldn't price this payout — check the recipient account, bank, and amount, then try again.";
  }
  if (isInternalIntegrationMessage(message)) {
    return "We couldn't get a price for this payout right now. Please try again shortly.";
  }
  return message;
}

type AcceptErrorData = {
  code?: string;
  available?: string | number | null;
  amount?: string | number | null;
  currency?: string | null;
  network?: string | null;
};

function formatMoney(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return String(value);
  return n.toLocaleString("en-US", { maximumFractionDigits: 6 });
}

function networkLabel(network: string | null | undefined): string | null {
  if (!network) return null;
  const compact = network.replace(/[^a-zA-Z]/g, "").toLowerCase();
  if (compact.startsWith("polygon")) return "Polygon";
  if (compact.startsWith("base")) return "Base";
  if (compact.startsWith("stellar")) return "Stellar";
  return network;
}

/**
 * Accept-time fund failures (Mboka ValidationError `data.code`).
 * Prefer structured envelope fields over raw aggregator prose.
 */
export function friendlySendAcceptError(
  message: string,
  data?: AcceptErrorData | null,
): string {
  if (data?.code === "insufficient_balance") {
    const currency = (data.currency || "USDT").toString().toUpperCase();
    const network = networkLabel(data.network ? String(data.network) : null);
    const need = formatMoney(data.amount);
    const available = formatMoney(data.available);
    const needPart = need
      ? `${need} ${currency}${network ? ` on ${network}` : ""}`
      : `${currency}${network ? ` on ${network}` : ""}`;
    const availablePart = available != null ? ` Available ${available}.` : "";
    return `Insufficient funds — you need ${needPart}.${availablePart} Top up your ${currency} balance and try again.`;
  }
  if (data?.code === "below_minimum") {
    const currency = (data.currency || "USDT").toString().toUpperCase();
    const amount = formatMoney(data.amount);
    return amount
      ? `Amount too small — the minimum send is higher than ${amount} ${currency}. Increase the amount and try again.`
      : `Amount too small for ${currency}. Increase the amount and try again.`;
  }
  if (data?.code === "asset_mismatch") {
    return "Settlement asset mismatch — this corridor can't settle on the selected crypto rail. Choose USDT on Polygon and try again.";
  }
  return friendlySendQuoteError(
    message,
    data && typeof data === "object" ? (data as SendQuoteErrorData) : null,
  );
}

/** The four entry points on the Send method chooser. `internal` has no
 *  backend yet, so it is presented disabled rather than omitted. */
export type SendMethod = "bank" | "mobile" | "crypto" | "internal";

/**
 * Rail index implied by the chosen send method for a given country.
 *
 * Picking "Bank transfer" or "Mobile money" answers the rail question up
 * front, so the flow preselects that rail instead of asking again in step 1.
 * Countries with no rail of that type (South Africa has no mobile money rail)
 * fall back to the first available rail.
 */
export function railIndexForMethod(
  rails: { type: string }[] | undefined,
  method: SendMethod | null,
): number {
  if (!rails || rails.length === 0) return 0;
  const wanted = method === "mobile" ? "mobile" : method === "bank" ? "bank" : null;
  if (!wanted) return 0;
  const idx = rails.findIndex((r) => r.type === wanted);
  return idx < 0 ? 0 : idx;
}

/**
 * Whether step 1 should still offer a payout-rail choice.
 *
 * It should not when the method chooser already fixed the rail — that would
 * ask the same question twice. But "fixed" only holds if the country actually
 * offers a rail of that type: pick Mobile money, then South Africa, and
 * `railIndexForMethod` falls back to the bank rail. Hiding the picker there
 * would silently turn a mobile-money send into a bank transfer with nothing
 * on screen saying so, so the picker stays visible in that case.
 */
export function sendRailHasChoice(
  rails: { type: string }[] | undefined,
  method: SendMethod | null,
): boolean {
  if (!rails || rails.length <= 1) return false;
  const wanted = method === "mobile" ? "mobile" : method === "bank" ? "bank" : null;
  if (!wanted) return true;
  return !rails.some((r) => r.type === wanted);
}
