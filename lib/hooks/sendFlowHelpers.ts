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
 * "Aggregator returned 400 for /partner/orders/quote". Also map structured
 * `data.field` / amount limits from partner preflight (Mboka ValidationError).
 */
export type SendQuoteErrorData = {
  upstream?: unknown;
  field?: string;
  code?: string;
  message?: string;
  detail?: string;
  min_amount?: string | number;
  max_amount?: string | number;
  currency?: string;
  example?: string;
  missing_fields?: unknown;
  [key: string]: unknown;
};

function isInternalIntegrationMessage(message: string): boolean {
  return (
    /aggregator returned\s+\d+/i.test(message) ||
    /\/partner\//i.test(message) ||
    /upstream request (timed out|failed)/i.test(message) ||
    /^HTTP\s+\d+$/i.test(message.trim()) ||
    /^quote request failed$/i.test(message.trim()) ||
    /^invalid request for this corridor$/i.test(message.trim()) ||
    /^validation error$/i.test(message.trim())
  );
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function extractUpstreamMessage(data: SendQuoteErrorData | null | undefined): string | null {
  if (!data || typeof data !== "object") return null;
  const body = asRecord(data.upstream);
  if (!body) return null;
  const direct = body.message ?? body.error ?? body.detail;
  if (typeof direct === "string" && direct.trim()) return direct.trim();
  const nested = asRecord(body.data);
  if (nested) {
    const nestedMsg = nested.message ?? nested.detail ?? nested.error;
    if (typeof nestedMsg === "string" && nestedMsg.trim()) return nestedMsg.trim();
  }
  return null;
}

function extractErrorField(data: SendQuoteErrorData | null | undefined): string | null {
  if (!data || typeof data !== "object") return null;
  if (typeof data.field === "string" && data.field.trim()) return data.field.trim();
  const upstream = asRecord(data.upstream);
  const nested = asRecord(upstream?.data) ?? upstream;
  const field = nested?.field;
  if (typeof field === "string" && field.trim()) return field.trim();
  return null;
}

function formatLimitAmount(value: string | number | undefined, currency?: string): string | null {
  if (value === undefined || value === null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  const amount = Number.isFinite(n)
    ? n.toLocaleString("en-US", { maximumFractionDigits: 2 })
    : String(value);
  const ccy = typeof currency === "string" && currency.trim() ? currency.trim().toUpperCase() : "";
  return ccy ? `${amount} ${ccy}` : amount;
}

function humanizeQuoteField(
  field: string,
  data?: SendQuoteErrorData | null,
  messageHint?: string | null,
): string | null {
  const normalized = field.trim().toLowerCase();
  const hint = (messageHint || "").trim();
  const example =
    typeof data?.example === "string" && data.example.trim() ? data.example.trim() : null;
  const currency =
    typeof data?.currency === "string" && data.currency.trim()
      ? data.currency.trim().toUpperCase()
      : undefined;
  const min = formatLimitAmount(data?.min_amount, currency);
  const max = formatLimitAmount(data?.max_amount, currency);

  if (normalized === "payment_method.network_id" || normalized.endsWith(".network_id")) {
    // Mboka missing-id: "…network_id is required…" — providers unavailable.
    // Partner invalid-id: "Invalid payment method network…" — pick another rail.
    if (/required/i.test(hint)) {
      return "This corridor can't be priced right now — our provider list is unavailable, so we can't route the payment. Please try again shortly.";
    }
    if (/invalid|unknown|not (?:found|supported)|unavailable/i.test(hint)) {
      return "This payout rail isn't available right now. Pick another bank or mobile operator, or try again shortly.";
    }
    return "This corridor can't be priced right now — our provider list is unavailable, so we can't route the payment. Please try again shortly.";
  }
  if (
    normalized === "payment_method.phone_number" ||
    normalized === "customer.phone_number" ||
    normalized.includes("phone")
  ) {
    return example
      ? `That phone number isn't valid for this corridor. Use international format (e.g. ${example}).`
      : "That phone number isn't valid for this corridor. Check the number and try again.";
  }
  if (normalized === "customer.name" || normalized.includes("account_name")) {
    return example
      ? `Enter the account holder's full name (first and last), e.g. ${example}.`
      : "Enter the account holder's full name (first and last), then try again.";
  }
  if (normalized === "customer.email") {
    return "Your business profile is missing an email address needed for this payout. Update Verification and try again.";
  }
  if (normalized === "customer.dob") {
    return "Your business profile needs a date of birth in mm/dd/yyyy for this corridor. Update Verification and try again.";
  }
  if (normalized.includes("business_name") || normalized.includes("business_id")) {
    return "Business registration details are incomplete for this payout. Finish Verification (business name and registration number), then try again.";
  }
  if (normalized.includes("additional_id")) {
    return "This Nigeria payout needs extra ID details we don't collect yet. Try another corridor or contact support.";
  }
  if (
    normalized === "amount" ||
    normalized === "local_amount" ||
    normalized === "crypto_amount" ||
    normalized.endsWith(".amount")
  ) {
    if (min && max) {
      return `Amount is outside this corridor's limits (${min} – ${max}). Adjust the amount and try again.`;
    }
    if (min) {
      return `Amount is below this corridor's minimum of ${min}. Increase the amount and try again.`;
    }
    if (max) {
      return `Amount is above this corridor's maximum of ${max}. Lower the amount and try again.`;
    }
    return "Amount isn't accepted for this bank corridor. Adjust the amount and try again.";
  }
  if (normalized.includes("account_number") || normalized.includes("account.number")) {
    return "That recipient account number doesn't look valid for the selected bank. Check it and try again.";
  }
  return null;
}

function humanizeQuoteDetail(message: string): string | null {
  if (/insufficient/i.test(message)) {
    // Keep client-side balance checks that already name available funds.
    if (/available/i.test(message)) return message;
    return "Insufficient funds to price this payout. Top up your wallet and try again.";
  }
  if (/no active payment channel|no.*channel matched/i.test(message)) {
    return "No payout channel matched this destination and amount. Try a different amount, bank, or mobile operator.";
  }
  if (/business registration details are required|business email is required/i.test(message)) {
    return "Business verification details are incomplete for this payout. Finish Verification, then try again.";
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
  if (/network.?id is required|payment_method\.network_id/i.test(message)) {
    return "This corridor can't be priced right now — our provider list is unavailable, so we can't route the payment. Please try again shortly.";
  }
  if (/network.?id|payment network|payment.?method/i.test(message) && /invalid|unavailable|unknown|not (?:found|supported)/i.test(message)) {
    return "This payout rail isn't available right now. Pick another bank or mobile operator, or try again shortly.";
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
  const field = extractErrorField(data);
  const messageHint = [upstreamMsg, message].find(
    (m): m is string => typeof m === "string" && m.trim().length > 0,
  );
  const fieldCopy = field ? humanizeQuoteField(field, data, messageHint) : null;
  if (fieldCopy) return fieldCopy;

  // Amount limits may arrive without a recognizable message (thin partner payload).
  if (data?.min_amount != null || data?.max_amount != null) {
    const amountCopy = humanizeQuoteField("amount", data);
    if (amountCopy) return amountCopy;
  }

  const candidates = [upstreamMsg, typeof data?.detail === "string" ? data.detail : null, message].filter(
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

  // Prefer a concrete upstream / partner reason when it isn't an internal wrapper.
  for (const candidate of [upstreamMsg, message]) {
    if (candidate && !isInternalIntegrationMessage(candidate)) {
      return candidate;
    }
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
  // Status-only fallbacks — only when the message is empty or an internal wrapper.
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
