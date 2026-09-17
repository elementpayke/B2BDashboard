import { apiEnvelope, type RequestOptions } from "@/lib/apiClient";
import type { ConversionOut } from "@/lib/services/conversions";
import { validateConvertAmount } from "@/lib/services/conversions";

export type StellarSwapQuoteIn = {
  source_account_id: string;
  destination_account_id: string;
  amount: string;
};

function idempotencyHeaders(key: string): RequestOptions {
  return { headers: { "Idempotency-Key": key } };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asText(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const text = String(value).trim();
  return text || null;
}

export function normalizeStellarSwap(
  raw: unknown,
  input?: Partial<StellarSwapQuoteIn>,
): ConversionOut {
  const obj = asRecord(raw) ?? {};
  const quoteId = asText(obj.quote_id ?? obj.id ?? obj.preview_token) || "";
  return {
    id: asText(obj.id) || quoteId,
    status: asText(obj.status) || "quoted",
    direction: "stable_to_stable",
    source_account_id: asText(obj.source_account_id) || input?.source_account_id || "",
    destination_account_id:
      asText(obj.destination_account_id) || input?.destination_account_id || "",
    source_currency:
      asText(obj.source_currency ?? obj.from_currency ?? obj.source_asset) || "USDT",
    destination_currency:
      asText(obj.destination_currency ?? obj.to_currency ?? obj.destination_asset) || "USDC",
    source_amount: asText(obj.source_amount ?? obj.amount ?? obj.amount_in) || input?.amount || "",
    destination_amount: asText(obj.destination_amount ?? obj.amount_out),
    fee_amount: asText(obj.fee_amount ?? obj.fee),
    fee_currency: asText(obj.fee_currency) || "USDC",
    quote_id: quoteId,
    order_id: asText(obj.order_id ?? obj.batch_id),
    ledger_journal_reference: asText(obj.ledger_journal_reference ?? obj.reference),
    expires_at: asText(obj.expires_at),
  };
}

export const stellarSwapsApi = {
  async quote(body: StellarSwapQuoteIn): Promise<ConversionOut> {
    const normalizedBody = {
      source_account_id: body.source_account_id,
      destination_account_id: body.destination_account_id,
      amount: validateConvertAmount(body.amount),
    };
    const raw = await apiEnvelope<unknown>(
      "POST",
      "/v1/stellar/swaps/quote",
      normalizedBody,
    );
    return normalizeStellarSwap(raw, normalizedBody);
  },

  async confirm(quoteId: string, idempotencyKey?: string): Promise<ConversionOut> {
    const key = idempotencyKey || `stellar-swap-confirm:${quoteId}`;
    const raw = await apiEnvelope<unknown>(
      "POST",
      "/v1/stellar/swaps/confirm",
      { quote_id: quoteId },
      idempotencyHeaders(key),
    );
    return normalizeStellarSwap(raw);
  },
};
