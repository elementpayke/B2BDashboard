import { apiEnvelope, type RequestOptions } from "@/lib/apiClient";
import { newIdempotencyKey } from "@/lib/services/orders";

/**
 * Phase 3 account conversions — EUR/GBP/USD ↔ USDC via Mboka
 * `POST /v1/conversions/quote` → `POST /v1/conversions/{quote_id}/accept`.
 *
 * Fiat↔fiat (e.g. EUR→USD) is not a partner rail; run two hops via USDC.
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

/** True when this pair needs a USDC bridge (fiat↔fiat). */
export function needsUsdcBridge(sourceCcy: string, destCcy: string): boolean {
  const fiat = new Set(["EUR", "USD", "GBP"]);
  const s = sourceCcy.trim().toUpperCase();
  const d = destCcy.trim().toUpperCase();
  return fiat.has(s) && fiat.has(d) && s !== d;
}

export const conversionsApi = {
  quote(body: ConversionQuoteIn): Promise<ConversionOut> {
    return apiEnvelope<ConversionOut>("POST", "/v1/conversions/quote", {
      source_account_id: body.source_account_id,
      destination_account_id: body.destination_account_id,
      amount: validateConvertAmount(body.amount),
    });
  },

  accept(quoteId: string, idempotencyKey?: string): Promise<ConversionOut> {
    const key = idempotencyKey || newIdempotencyKey();
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
