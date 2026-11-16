import { apiEnvelope, type RequestOptions } from "@/lib/apiClient";

/**
 * Phase 3 ramp conversions — EUR/GBP/USD ↔ USDC via Mboka
 * `POST /v1/conversions/quote` → `POST /v1/conversions/{quote_id}/accept`.
 *
 * Fiat↔fiat ledger FX uses entity account conversions instead
 * (`lib/services/ledgerConversions.ts` → Aggregator customer conversions).
 */

export type ConversionOut = {
  id: string;
  status: string;
  direction: string;
  source_account_id: string;
  destination_account_id: string;
  source_currency: string;
  destination_currency: string;
  source_amount: string;
  destination_amount: string | null;
  fee_amount: string | null;
  fee_currency: string | null;
  quote_id: string;
  order_id: string | null;
  ledger_journal_reference: string | null;
  expires_at: string | null;
  /**
   * Ledger conversions only: `direct` settles in one call at a locked rate;
   * `bridged` (a Stellar USDC leg) settles over minutes, in stages.
   */
  route?: "direct" | "bridged" | null;
  /** False when the destination amount is priced on arrival — no countdown. */
  rate_locked?: boolean;
  /** True when `destination_amount` is an estimate, not a firm figure. */
  destination_amount_estimated?: boolean;
  /** "estimated" until settled: Nuvion debits its fee on top and won't quote it. */
  fee_status?: string | null;
  /** Backend copy to show with the quote (e.g. "takes a few minutes"). */
  notice?: string | null;
  /** Bridged job progress — see `ConversionJobStatus`. */
  stage?: string | null;
  stages?: string[];
  return_reason?: string | null;
  error?: string | null;
};

export type ConversionQuoteIn = {
  source_account_id: string;
  destination_account_id: string;
  amount: string;
};

const MIN_AMOUNT = 1;

function idempotencyHeaders(key: string): RequestOptions {
  return { headers: { "Idempotency-Key": key } };
}

export function validateConvertAmount(amount: string): string {
  const trimmed = amount.trim().replace(/,/g, "");
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < MIN_AMOUNT) {
    throw new Error(`Minimum convert amount is ${MIN_AMOUNT.toFixed(2)}.`);
  }
  return trimmed;
}

export function formatConvertAmount(value: string | null | undefined): string {
  if (value == null || value === "") return "—";
  const n = Number(String(value).replace(/,/g, ""));
  if (!Number.isFinite(n)) return String(value);
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  });
}

export function secondsUntilExpiry(expiresAt: string | null | undefined): number {
  if (!expiresAt) return 0;
  const raw = expiresAt.trim();
  if (!raw) return 0;
  // Partner / Mboka often return naive ISO datetimes that are UTC. ES Date.parse
  // treats those as *local*, which makes quotes look expired in non-UTC zones.
  const hasZone = /([zZ]|[+-]\d{2}:?\d{2})$/.test(raw);
  const normalized = hasZone ? raw : `${raw}Z`;
  const t = Date.parse(normalized);
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, Math.floor((t - Date.now()) / 1000));
}

export function describeConversionRate(quote: ConversionOut): string {
  const src = Number(quote.source_amount);
  const dst = Number(quote.destination_amount || 0);
  if (!Number.isFinite(src) || !Number.isFinite(dst) || src <= 0 || dst <= 0) {
    return "—";
  }
  const rate = dst / src;
  return `1 ${quote.source_currency} → ${rate.toLocaleString(undefined, {
    maximumFractionDigits: 6,
  })} ${quote.destination_currency}`;
}

/**
 * Fiat currencies the aggregator's ledger (Nuvion) rail can convert.
 *
 * Mirrors `LEDGER_FIAT_CURRENCIES` in the aggregator's
 * `partner_orders/network_registry.py`. A customer can *hold* far more than
 * this — the account catalog lists 30 — but `customer_conversion.py` rejects
 * any leg outside this set with a 422, so offering KES/TZS/ZAR in a convert
 * picker only moves the failure to after the user has committed to a pair.
 *
 * Keep in sync with the aggregator: widening here alone produces a confusing
 * 422, narrowing hides currencies that do work.
 */
export const LEDGER_FIAT_CURRENCIES = [
  "EUR",
  "USD",
  "GBP",
  "CAD",
  "NGN",
  "GHS",
  "AED",
] as const;

export function isLedgerFiatCurrency(code: string | null | undefined): boolean {
  const upper = String(code ?? "").trim().toUpperCase();
  return (LEDGER_FIAT_CURRENCIES as readonly string[]).includes(upper);
}

/**
 * Fiat currencies convertible *to or from a stablecoin*.
 *
 * Narrower than {@link LEDGER_FIAT_CURRENCIES} because the two routes do not
 * share a backend. Fiat↔fiat (and stablecoin↔stablecoin) go to the
 * aggregator's ledger-conversion endpoint, which allows all seven above.
 * Fiat↔stablecoin goes to Mboka's `/v1/conversions/quote`, whose
 * `resolve_pair` accepts only `EUR/GBP/USD ↔ USDC|USDT` and 422s anything
 * else:
 *
 *   "conversions support only EUR/GBP/USD ↔ USDC|USDT"
 *
 * Offering NGN on the ramp produced exactly that error — after the user had
 * chosen a pair and typed an amount. Widen this only when Mboka's
 * `FIAT_CURRENCIES` widens with it.
 */
export const RAMP_FIAT_CURRENCIES = ["EUR", "GBP", "USD"] as const;

export function isRampFiatCurrency(code: string | null | undefined): boolean {
  const upper = String(code ?? "").trim().toUpperCase();
  return (RAMP_FIAT_CURRENCIES as readonly string[]).includes(upper);
}

/** True when this pair needs a USDC bridge (fiat↔fiat). */
export function needsUsdcBridge(sourceCcy: string, destCcy: string): boolean {
  const s = sourceCcy.trim().toUpperCase();
  const d = destCcy.trim().toUpperCase();
  return isLedgerFiatCurrency(s) && isLedgerFiatCurrency(d) && s !== d;
}

export type ConvertPickAccount = {
  id: string;
  currency: string;
  /** Raw available; null/undefined treated as unknown (sorted after funded). */
  balanceAmount?: number | null;
};

/** Prefer funded accounts so Convert opens on a pair you can actually quote. */
export function pickPreferredConvertAccountId(
  accounts: ConvertPickAccount[],
  excludeIds: Iterable<string> = [],
): string {
  const excluded = new Set(
    [...excludeIds].map((id) => String(id || "").trim()).filter(Boolean),
  );
  const ranked = accounts
    .filter((a) => a.id && !excluded.has(String(a.id)))
    .slice()
    .sort((a, b) => {
      const av = typeof a.balanceAmount === "number" ? a.balanceAmount : -1;
      const bv = typeof b.balanceAmount === "number" ? b.balanceAmount : -1;
      return bv - av;
    });
  return ranked[0]?.id ? String(ranked[0].id) : "";
}

/** Fiat↔fiat destinations must differ in currency (bridge is USDC, not same-ccy book transfer). */
export function filterCrossCurrencyFiatAccounts<T extends ConvertPickAccount>(
  accounts: T[],
  sourceCurrency: string | null | undefined,
  excludeAccountId?: string | null,
): T[] {
  const src = String(sourceCurrency || "")
    .trim()
    .toUpperCase();
  const exclude = String(excludeAccountId || "").trim();
  return accounts.filter((a) => {
    if (!a.id || (exclude && String(a.id) === exclude)) return false;
    if (!src) return true;
    return String(a.currency || "")
      .trim()
      .toUpperCase() !== src;
  });
}

/** Short path copy for ledger fiat↔fiat, e.g. "EUR → USD". */
export function describeFiatFiatPath(
  sourceCurrency: string | null | undefined,
  destCurrency: string | null | undefined,
): string | null {
  const s = String(sourceCurrency || "")
    .trim()
    .toUpperCase();
  const d = String(destCurrency || "")
    .trim()
    .toUpperCase();
  if (!s || !d || s === d) return null;
  return `${s} → ${d}`;
}

export const conversionsApi = {
  quote(body: ConversionQuoteIn): Promise<ConversionOut> {
    return apiEnvelope<ConversionOut>("POST", "/v1/conversions/quote", {
      source_account_id: body.source_account_id,
      destination_account_id: body.destination_account_id,
      amount: validateConvertAmount(body.amount),
    });
  },

  /**
   * The default key is derived from `quoteId`, not minted fresh: a quote is
   * accepted exactly once, and the UI lets the user press "Accept & settle"
   * again after a failure. A random key per attempt would let a request that
   * reached the backend and then timed out settle twice on retry.
   */
  accept(quoteId: string, idempotencyKey?: string): Promise<ConversionOut> {
    const key = idempotencyKey || `conversion-accept:${quoteId}`;
    return apiEnvelope<ConversionOut>(
      "POST",
      `/v1/conversions/${encodeURIComponent(quoteId)}/accept`,
      {},
      idempotencyHeaders(key),
    );
  },

  get(conversionId: string): Promise<ConversionOut> {
    return apiEnvelope<ConversionOut>(
      "GET",
      `/v1/conversions/${encodeURIComponent(conversionId)}`,
    );
  },
};
