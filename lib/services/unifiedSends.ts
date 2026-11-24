import { ApiRequestError } from "@/lib/apiClient";
import { mboka, type MbokaSchema } from "@/lib/api/mboka";

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
