import { ApiRequestError } from "@/lib/apiClient";
import { mboka, type MbokaSchema } from "@/lib/api/mboka";
import { isValidBic, isValidIban, isValidRoutingNumber, looksLikeIban } from "@/lib/bankChecks";

/**
 * Unified sends — one contract for bank, mobile money and stablecoin sends.
 *
 * Endpoints (Mboka, see `../Mboka-Backend/app/routes/unified_sends.py`):
 * - `GET  /v1/sends/options`   methods, destinations, payable balances
 * - `POST /v1/sends/estimate`  fee, rate and total before a recipient is entered
 * - `POST /v1/sends/quote`     binding price with an expiry
 * - `POST /v1/sends`           confirm (Idempotency-Key REQUIRED, 8–64 chars)
 * - `GET  /v1/sends/{send_id}` one status shape, with failure reason and refund
 *
 * The backend picks the money path (direct, or through a stablecoin account);
 * this module never sees legs. Everything here is behind
 * `NEXT_PUBLIC_UNIFIED_SENDS` so the composer keeps its existing order /
 * account-send wiring wherever the new routes are not live yet.
 */

export type SendOptions = MbokaSchema<"SendOptionsOut">;
export type SendDestination = MbokaSchema<"DestinationOut">;
export type SendEstimate = MbokaSchema<"EstimateOut">;
export type SendQuote = MbokaSchema<"QuoteOut">;
export type SendQuoteRequest = MbokaSchema<"QuoteIn">;
export type SendEstimateRequest = MbokaSchema<"EstimateIn">;
export type UnifiedSend = MbokaSchema<"SendStatusOut">;
export type SendMoney = MbokaSchema<"Money">;

export type UnifiedSendOutcome = "sending" | "processing" | "delivered" | "failed" | "refunded";

/** True when the composer should price and send through `/v1/sends`. */
export function unifiedSendsEnabled(): boolean {
  return process.env.NEXT_PUBLIC_UNIFIED_SENDS === "true";
}

export const unifiedSendsApi = {
  options: (): Promise<SendOptions> => mboka.get("/v1/sends/options"),
  estimate: (body: SendEstimateRequest): Promise<SendEstimate> =>
    mboka.post("/v1/sends/estimate", { body }),
  quote: (body: SendQuoteRequest): Promise<SendQuote> => mboka.post("/v1/sends/quote", { body }),
  refresh: (quoteId: string) =>
    mboka.post("/v1/sends/quote/{quote_id}/refresh", { path: { quote_id: quoteId } }),
  confirm: (quoteId: string, idempotencyKey: string): Promise<UnifiedSend> =>
    mboka.post("/v1/sends", {
      body: { quote_id: quoteId },
      headers: { "Idempotency-Key": idempotencyKey },
    }),
  get: (sendId: string): Promise<UnifiedSend> =>
    mboka.get("/v1/sends/{send_id}", { path: { send_id: sendId } }),
};

// ---------------------------------------------------------------------------
// Destination lookup
// ---------------------------------------------------------------------------

function norm(value: string | null | undefined): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * The destination for a country payout the composer has picked.
 *
 * Matches on country + method + provider name (the name the catalog shows),
 * and only returns a destination that is live. Null means the unified route
 * cannot carry this payout — callers fail closed with a clear message.
 */
export function findPayoutDestination(
  options: SendOptions | null | undefined,
  pick: { countryIso: string; railType: string; providerName: string },
): SendDestination | null {
  if (!options) return null;
  const method = pick.railType === "mobile" ? "mobile_money" : "bank";
  const country = pick.countryIso.trim().toUpperCase();
  const wanted = norm(pick.providerName);
  if (!wanted) return null;
  const candidates = options.destinations.filter(
    (d) => d.method === method && (d.country ?? "").toUpperCase() === country && d.status === "live",
  );
  return (
    candidates.find((d) => norm(d.name) === wanted) ??
    candidates.find((d) => norm(d.name).includes(wanted) || wanted.includes(norm(d.name))) ??
    null
  );
}

/** The wallet destination for an asset on a chain, e.g. USDT on Polygon. */
export function findWalletDestination(
  options: SendOptions | null | undefined,
  pick: { asset: string; network: string },
): SendDestination | null {
  if (!options) return null;
  const asset = pick.asset.trim().toUpperCase();
  const network = norm(pick.network);
  return (
    options.destinations.find(
      (d) =>
        d.method === "stablecoin" &&
        d.status === "live" &&
        d.currency.toUpperCase() === asset &&
        norm(d.network) === network,
    ) ?? null
  );
}

// ---------------------------------------------------------------------------
// Presentation
// ---------------------------------------------------------------------------

export function moneyText(money: SendMoney | null | undefined): string | null {
  if (!money || !String(money.value ?? "").trim()) return null;
  return `${money.value} ${money.currency}`;
}

/** A fee of zero is real information: say "No fee" rather than "0.00 USDT". */
export function feeText(money: SendMoney | null | undefined): string | null {
  if (!money) return null;
  const amount = Number(money.value);
  if (Number.isFinite(amount) && amount === 0) return "No fee";
  return moneyText(money);
}

/** "1 USDT = 128.00 KES" from the quote's own rate. Null for same-currency sends. */
export function rateLine(price: Pick<SendQuote, "rate"> | null | undefined): string | null {
  const rate = price?.rate;
  if (!rate || rate.from === rate.to) return null;
  return `1 ${rate.from} = ${rate.value} ${rate.to}`;
}

/**
 * The legacy order-quote shape the review screen already renders
 * (`amounts.user_pays` / `user_receives` / `fees` / `rate`), filled from a
 * unified quote so no figure is recomputed in the browser.
 */
export function toOrderQuoteShape(quote: SendQuote) {
  return {
    quote_id: quote.quote_id,
    expires_at: quote.expires_at,
    amounts: {
      rate: quote.rate?.value ?? null,
      rate_currency: quote.rate?.to ?? quote.receive_amount.currency,
      user_pays: { amount: quote.total_debit.value, currency: quote.total_debit.currency },
      user_receives: {
        amount: quote.receive_amount.value,
        currency: quote.receive_amount.currency,
      },
      fees: { amount: quote.fee.value, currency: quote.fee.currency },
    },
  };
}

/**
 * The legacy account-send preview shape the stablecoin review renders. There
 * is no `preview_token`: the unified quote id confirms the send instead.
 */
export function toSendPreviewShape(quote: SendQuote) {
  return {
    currency: quote.total_debit.currency,
    amount: quote.send_amount.value,
    fee_amount: quote.fee.value,
    total_debit: quote.total_debit.value,
    receive_amount: quote.receive_amount.value,
    expires_at: quote.expires_at,
  };
}

export function isFinalSend(send: Pick<UnifiedSend, "status" | "refund"> | null | undefined): boolean {
  if (!send) return false;
  if (send.status === "delivered" || send.status === "refunded") return true;
  // A failed send whose refund is still pending can still become "refunded".
  return send.status === "failed" && send.refund?.status !== "pending";
}

/**
 * How often to re-read a send that has not reached a final status.
 *
 * Every 2s for the first minute (while someone is watching the status
 * screen), then every 5s. A failed send waiting on a provider refund is read
 * every 15s. The backend budgets requests per peer, so this never polls
 * faster than the existing order tracker does.
 */
export function sendPollIntervalMs(
  send: UnifiedSend | null | undefined,
  attempt = 0,
): number | false {
  if (send && isFinalSend(send)) return false;
  if (send?.status === "failed") return 15000;
  return attempt > 30 ? 5000 : 2000;
}

/** User-facing line for a failed or refunded send, straight from the backend. */
export function failureMessage(send: UnifiedSend | null | undefined): string | null {
  return send?.failure?.message?.trim() || null;
}

/** "Your 99.50 USDT is back in your account." once a refund is confirmed. */
export function refundText(send: UnifiedSend | null | undefined): string | null {
  if (!send?.refund || send.refund.status !== "completed") return null;
  return moneyText(send.refund.amount);
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export type SendApiErrorDetail = {
  code: string;
  message: string;
  field: string | null;
  limit: SendMoney | null;
};

/** The `data.error` block every 4xx on `/v1/sends/*` carries, or null. */
export function sendApiError(err: unknown): SendApiErrorDetail | null {
  if (!(err instanceof ApiRequestError)) return null;
  const data = err.data;
  if (!data || typeof data !== "object") return null;
  const error = (data as { error?: unknown }).error;
  if (!error || typeof error !== "object") return null;
  const e = error as Record<string, unknown>;
  if (typeof e.code !== "string" || typeof e.message !== "string") return null;
  const limit = e.limit && typeof e.limit === "object" ? (e.limit as SendMoney) : null;
  return {
    code: e.code,
    message: e.message,
    field: typeof e.field === "string" ? e.field : null,
    limit,
  };
}

/** Backend copy when present, otherwise the given fallback. Never a raw status code. */
export function sendErrorMessage(err: unknown, fallback: string): string {
  const detail = sendApiError(err);
  if (detail) return detail.message;
  if (err instanceof ApiRequestError && err.message.trim()) return err.message;
  if (err instanceof Error && err.message.trim()) return err.message;
  return fallback;
}

export function isQuoteExpired(err: unknown): boolean {
  return sendApiError(err)?.code === "quote_expired";
}

// ---------------------------------------------------------------------------
// Payout rails (ACH, wire, SWIFT …) paid straight from a held balance
// ---------------------------------------------------------------------------

/**
 * Live rails one of the caller's own balances pays directly, for a currency.
 * These are the destinations that carry `source_account_ids`; a bank reached
 * by converting from a stablecoin wallet does not.
 */
export function payoutRailDestinations(
  options: SendOptions | null | undefined,
  currency: string | null | undefined,
): SendDestination[] {
  const wanted = String(currency ?? "").trim().toUpperCase();
  if (!options || !wanted) return [];
  return options.destinations.filter(
    (d) =>
      d.method === "bank" &&
      d.status === "live" &&
      (d.source_account_ids?.length ?? 0) > 0 &&
      d.currency.toUpperCase() === wanted,
  );
}

/** The balance that pays a rail, with its available amount when known. */
export function payoutSource(
  options: SendOptions | null | undefined,
  destination: SendDestination | null | undefined,
): MbokaSchema<"SourceOut"> | null {
  const ids = destination?.source_account_ids ?? [];
  if (!options || ids.length === 0) return null;
  return options.sources.find((s) => ids.includes(s.account_id)) ?? null;
}

export type SendExtraField = {
  /** Key sent in `recipient.details`. */
  key: string;
  label: string;
  placeholder?: string;
  /** Asked before the account number: it identifies the bank being paid. */
  lead?: boolean;
  /** The rail's country, when it pins one (US for ACH and wire). */
  country?: string | null;
};

/** Identifiers that say which bank is being paid; asked first. */
const LEAD_FIELDS = new Set(["routing_number", "swift_bic"]);

const EXTRA_FIELD_LABELS: Record<string, { label: string; placeholder?: string }> = {
  routing_number: { label: "Routing number", placeholder: "9 digits" },
  bank_name: { label: "Bank name", placeholder: "e.g. Chase" },
  swift_bic: { label: "SWIFT / BIC", placeholder: "e.g. CHASUS33" },
  iban: { label: "IBAN" },
  account_type: { label: "Account type", placeholder: "checking or savings" },
  country: { label: "Bank country (2-letter code)", placeholder: "e.g. US" },
  bank_code: { label: "Bank code" },
  bank_institution_number: { label: "Institution number", placeholder: "3 digits" },
  transit_number: { label: "Transit number", placeholder: "5 digits" },
  beneficiary_email: { label: "Recipient email", placeholder: "name@example.com" },
  beneficiary_address_line_1: { label: "Recipient street address" },
  beneficiary_city: { label: "Recipient city" },
  beneficiary_postal_code: { label: "Recipient postal code" },
};

/**
 * Extra inputs a rail needs beyond the account number and the account name,
 * which the recipient step already collects. The country is skipped when the
 * rail pins it, and an "IBAN or account number" pair is covered by the account
 * input.
 */
export function recipientExtraFields(
  destination: SendDestination | null | undefined,
): SendExtraField[] {
  const out: SendExtraField[] = [];
  // A SWIFT/BIC carries its country, so the backend fills it in.
  const bicGivesCountry = (destination?.required_fields ?? []).includes("swift_bic");
  for (const raw of destination?.required_fields ?? []) {
    const names = raw.split("|");
    if (names.includes("account_number") || names.includes("account_holder_name")) continue;
    const key = names[0];
    if (key === "country" && (destination?.country || bicGivesCountry)) continue;
    const copy = EXTRA_FIELD_LABELS[key];
    out.push({
      key,
      label: copy?.label ?? key.replace(/_/g, " "),
      placeholder: copy?.placeholder,
      lead: LEAD_FIELDS.has(key),
      country: destination?.country ?? null,
    });
  }
  // Bank identifier first, then the rest in the order the rail lists them.
  return [...out.filter((f) => f.lead), ...out.filter((f) => !f.lead)];
}

/** The first extra field still empty, or null when the form is complete. */
export function missingExtraField(
  fields: SendExtraField[],
  values: Record<string, string> | null | undefined,
): SendExtraField | null {
  return fields.find((f) => !String(values?.[f.key] ?? "").trim()) ?? null;
}

/** `recipient.details` for the quote: only this rail's fields, trimmed. */
export function recipientDetails(
  fields: SendExtraField[],
  values: Record<string, string> | null | undefined,
): Record<string, string> | undefined {
  const out: Record<string, string> = {};
  for (const field of fields) {
    const value = String(values?.[field.key] ?? "").trim();
    if (value) out[field.key] = value;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * Why a typed bank identifier cannot be right, or null. Empty values are not
 * errors here: `missingExtraField` covers "not filled in yet".
 */
export function extraFieldError(
  key: string,
  value: string | null | undefined,
  country?: string | null,
): string | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  if (key === "beneficiary_email" && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(text)) {
    return "Enter a full email address, like name@example.com.";
  }
  if (
    key === "beneficiary_postal_code" &&
    (country ?? "").toUpperCase() === "US" &&
    !/^[0-9]{5}(-?[0-9]{4})?$/.test(text)
  ) {
    return "Enter a 5-digit US ZIP code.";
  }
  if (key === "routing_number" && !isValidRoutingNumber(text)) {
    return "That routing number is not valid. Check the nine digits.";
  }
  if (key === "swift_bic" && !isValidBic(text)) {
    return "That SWIFT/BIC is not valid. It is 8 or 11 characters, like CHASUS33.";
  }
  if (key === "iban" && !isValidIban(text)) {
    return "That IBAN is not valid. Check it against the recipient’s details.";
  }
  return null;
}

/** The first extra field holding a malformed identifier, with the reason. */
export function invalidExtraField(
  fields: SendExtraField[],
  values: Record<string, string> | null | undefined,
): { field: SendExtraField; message: string } | null {
  for (const field of fields) {
    const message = extraFieldError(field.key, values?.[field.key], field.country);
    if (message) return { field, message };
  }
  return null;
}

/**
 * A SWIFT payment takes an IBAN or an account number in the one account box.
 * When what was typed is meant as an IBAN, it has to be a valid one.
 */
export function accountBoxError(
  fields: SendExtraField[],
  account: string | null | undefined,
): string | null {
  if (!fields.some((f) => f.key === "swift_bic")) return null;
  const text = String(account ?? "").trim();
  if (!text || !looksLikeIban(text)) return null;
  return isValidIban(text) ? null : "That IBAN is not valid. Check it against the recipient’s details.";
}

/**
 * The places a bank or mobile-money payment can actually go.
 *
 * The catalog lists two kinds of corridor: real countries (Kenya, Nigeria …)
 * with banks to pick from, and bare currencies (USD, CAD, EUR …) whose
 * "providers" are conversion routes, not banks. A bare currency is only worth
 * offering when one of the caller's balances has a live rail for it (ACH or
 * wire from a USD balance); otherwise there is nothing to choose.
 */
export function payableCorridors<T extends { iso: string; code: string }>(
  corridors: T[],
  countryCorridorIsos: Iterable<string>,
  options: SendOptions | null | undefined,
): T[] {
  const countries = new Set([...countryCorridorIsos].map((iso) => iso.toUpperCase()));
  return corridors.filter(
    (c) => countries.has(c.iso.toUpperCase()) || payoutRailDestinations(options, c.code).length > 0,
  );
}

// ---------------------------------------------------------------------------
// Where the money comes from
// ---------------------------------------------------------------------------

export type SendSource = MbokaSchema<"SourceOut">;

/**
 * Accounts that can pay a destination. A rail paid from a held balance names
 * its accounts; anything else can be tried from any account, and the backend
 * says so plainly when it has no route.
 */
export function eligibleSendSources(
  options: SendOptions | null | undefined,
  destination: SendDestination | null | undefined,
): SendSource[] {
  const sources = options?.sources ?? [];
  const ids = destination?.source_account_ids ?? [];
  return ids.length > 0 ? sources.filter((s) => ids.includes(s.account_id)) : sources;
}

/**
 * The account to pay from: the one already chosen, else a funded stablecoin
 * wallet (it pays a bank or mobile wallet in one step, with no conversion
 * first), else any funded account, else the first. Null when there are none.
 */
export function defaultSendSource(
  sources: SendSource[],
  preferredId: string | null | undefined,
): SendSource | null {
  const funded = sources.filter((s) => Number(s.available) > 0);
  return (
    sources.find((s) => s.account_id === preferredId) ??
    funded.find((s) => Boolean(s.network)) ??
    funded[0] ??
    sources[0] ??
    null
  );
}

/** "USDC · Base · Available 5.28 USDC" for the pay-from picker. */
export function sendSourceLabel(source: SendSource): string {
  const balance =
    source.available != null && String(source.available).trim()
      ? `Available ${source.available} ${source.currency}`
      : "Balance not available";
  return `${source.label} · ${balance}`;
}

/** Dollar-pegged balances, where a typed USD figure is the amount itself. */
export function isUsdLike(currency: string | null | undefined): boolean {
  return ["USD", "USDC", "USDT"].includes(String(currency ?? "").trim().toUpperCase());
}

// ---------------------------------------------------------------------------
// Live breakdown on the amount step
// ---------------------------------------------------------------------------

export type SendBreakdownRow = {
  key: "rate" | "fee" | "converted" | "receive" | "total";
  label: string;
  value: string;
  /** The line that matters most in its group. */
  strong?: boolean;
  /** Starts the totals group: drawn with a rule above it. */
  divider?: boolean;
};

export type SendBreakdownHeadline = {
  /** "They receive" when the amount was typed as money leaving; else "You send". */
  label: string;
  value: string;
};

/** "0.0849 USDC", "12,958.00 KES": two to four decimals, grouped thousands. */
function shortMoney(money: SendMoney | null | undefined): string | null {
  if (!money || !String(money.value ?? "").trim()) return null;
  const value = Number(money.value);
  if (!Number.isFinite(value)) return moneyText(money);
  const shown = value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });
  return `${shown} ${money.currency}`;
}

/** A rate without a long tail: "1 USDC = 128.9 KES". */
function shortRateLine(estimate: Pick<SendEstimate, "rate">): string | null {
  const rate = estimate.rate;
  if (!rate || rate.from === rate.to) return null;
  const value = Number(rate.value);
  const shown = Number.isFinite(value)
    ? value.toLocaleString("en-US", { maximumFractionDigits: value < 1 ? 6 : 2 })
    : rate.value;
  return `1 ${rate.from} = ${shown} ${rate.to}`;
}

/**
 * What the typed amount turns into, from a non-binding estimate: the exchange
 * rate, the fee, what is converted, what the recipient gets, then the total
 * taken from the account. Every figure is the backend's; nothing is recomputed
 * here. A fee the provider only reveals with a recipient is shown as pending,
 * never as free.
 */
export function estimateBreakdown(
  estimate: SendEstimate,
  opts: { recipient?: string | null } = {},
): SendBreakdownRow[] {
  const rows: SendBreakdownRow[] = [];
  const rate = shortRateLine(estimate);
  if (rate) rows.push({ key: "rate", label: "Exchange rate", value: rate });
  const feeValue = Number(estimate.fee.value);
  const fee = estimate.fee_known === false
    ? feeValue > 0
      ? `${shortMoney(estimate.fee)} + provider fee`
      : "Shown on the next step"
    : feeValue === 0
      ? "No fee"
      : shortMoney(estimate.fee);
  if (fee) rows.push({ key: "fee", label: "Fee", value: fee });
  // Only worth a line when a fee was taken out before converting.
  const converted = shortMoney(estimate.send_amount);
  if (rate && feeValue > 0 && converted) {
    rows.push({ key: "converted", label: "Amount converted", value: converted });
  }
  const receive = shortMoney(estimate.receive_amount);
  if (receive) {
    rows.push({
      key: "receive",
      label: `${opts.recipient?.trim() || "Recipient"} receives`,
      value: `≈ ${receive}`,
      strong: true,
    });
  }
  const total = shortMoney(estimate.total_debit);
  if (total) {
    rows.push({ key: "total", label: "Total deducted", value: total, strong: true, divider: true });
  }
  return rows;
}

/**
 * The other side of what was typed, shown large under the amount box: what
 * the recipient receives for money typed as leaving, or what leaves for an
 * amount typed as received.
 */
export function estimateHeadline(
  estimate: SendEstimate,
  opts: { typedIsReceive: boolean; recipient?: string | null },
): SendBreakdownHeadline | null {
  if (opts.typedIsReceive) {
    const total = shortMoney(estimate.total_debit);
    return total ? { label: "You send", value: total } : null;
  }
  const receive = shortMoney(estimate.receive_amount);
  return receive
    ? { label: `${opts.recipient?.trim() || "They"} receive${opts.recipient?.trim() ? "s" : ""}`, value: receive }
    : null;
}
