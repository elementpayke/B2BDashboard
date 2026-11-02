/**
 * Same-customer cross-currency ledger FX via Mboka → Aggregator customer conversions.
 * Partner docs: POST …/accounts/{id}/conversions/preview|confirm
 * Distinct from Phase-3 ramp `/v1/conversions` (fiat↔stable orders).
 */

import { apiEnvelope, type RequestOptions } from "@/lib/apiClient";
import type { ConversionOut } from "@/lib/services/conversions";
import { validateConvertAmount } from "@/lib/services/conversions";

export type LedgerConversionPreview = {
  preview_token?: string;
  from_account_id?: string | number;
  to_account_id?: string | number;
  from_currency?: string;
  to_currency?: string;
  amount_from?: string;
  amount_to?: string;
  rate?: number | string | null;
  fee?: string | null;
  fee_status?: string | null;
  expires_at?: string | null;
  [key: string]: unknown;
};

export type LedgerConversionResult = {
  id?: string;
  status?: string;
  from_account_id?: string | number;
  to_account_id?: string | number;
  from_currency?: string;
  to_currency?: string;
  amount_from?: string;
  amount_to?: string;
  rate?: number | string | null;
  [key: string]: unknown;
};

function idempotencyHeaders(key: string): RequestOptions {
  return { headers: { "Idempotency-Key": key } };
}

/** Map Aggregator/Mboka ledger preview into the Convert UI quote shape. */
export function ledgerPreviewToConversionOut(
  preview: LedgerConversionPreview,
  ids: { sourceAccountId: string; destinationAccountId: string },
): ConversionOut {
  const token = String(preview.preview_token || "").trim();
  if (!token) {
    throw new Error("Conversion preview did not return a preview_token.");
  }
  return {
    id: token,
    status: "quoted",
    direction: "ledger_fx",
    source_account_id: String(preview.from_account_id ?? ids.sourceAccountId),
    destination_account_id: String(preview.to_account_id ?? ids.destinationAccountId),
    source_currency: String(preview.from_currency || "").toUpperCase(),
    destination_currency: String(preview.to_currency || "").toUpperCase(),
    source_amount: String(preview.amount_from ?? ""),
    destination_amount:
      preview.amount_to == null || preview.amount_to === ""
        ? null
        : String(preview.amount_to),
    fee_amount: preview.fee == null ? null : String(preview.fee),
    fee_currency: String(preview.from_currency || "").toUpperCase() || null,
    quote_id: token,
    order_id: null,
    ledger_journal_reference: null,
    expires_at: preview.expires_at ? String(preview.expires_at) : null,
  };
}

export function ledgerResultToConversionOut(
  result: LedgerConversionResult,
  fallback: ConversionOut,
): ConversionOut {
  return {
    ...fallback,
    id: String(result.id || fallback.id),
    status: String(result.status || "completed"),
    source_amount: String(result.amount_from ?? fallback.source_amount),
    destination_amount:
      result.amount_to == null || result.amount_to === ""
        ? fallback.destination_amount
        : String(result.amount_to),
    source_currency: String(result.from_currency || fallback.source_currency).toUpperCase(),
    destination_currency: String(
      result.to_currency || fallback.destination_currency,
    ).toUpperCase(),
    order_id: null,
  };
}

export const ledgerConversionsApi = {
  preview(
    entityId: string,
    accountId: string,
    body: { destination_account_id: string; amount: string },
  ): Promise<LedgerConversionPreview> {
    return apiEnvelope<LedgerConversionPreview>(
      "POST",
      `/v1/entities/${encodeURIComponent(entityId)}/accounts/${encodeURIComponent(accountId)}/conversions/preview`,
      {
        destination_account_id: body.destination_account_id,
        amount: validateConvertAmount(body.amount),
      },
    );
  },

  confirm(
    entityId: string,
    accountId: string,
    body: { preview_token: string; idempotency_key?: string },
  ): Promise<LedgerConversionResult> {
    const token = String(body.preview_token || "").trim();
    const key = (body.idempotency_key || `ledger-fx:${token}`).slice(0, 64);
    return apiEnvelope<LedgerConversionResult>(
      "POST",
      `/v1/entities/${encodeURIComponent(entityId)}/accounts/${encodeURIComponent(accountId)}/conversions`,
      {
        preview_token: token,
        idempotency_key: key,
      },
      idempotencyHeaders(key),
    );
  },
};
