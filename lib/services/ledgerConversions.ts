/**
 * Same-customer cross-currency ledger FX via Mboka → Aggregator customer conversions.
 * Partner docs: POST …/accounts/{id}/conversions/preview|confirm
 * Distinct from Phase-3 ramp `/v1/conversions` (fiat↔stable orders).
 */

import { ApiRequestError, apiEnvelope, type RequestOptions } from "@/lib/apiClient";
import type { ConversionOut } from "@/lib/services/conversions";
import { validateConvertAmount } from "@/lib/services/conversions";
import { listCurrencies } from "@/lib/services/convertRoutes";

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
  route?: "direct" | "bridged" | string | null;
  rate_locked?: boolean | null;
  amount_to_status?: "locked" | "estimated" | string | null;
  notice?: string | null;
  stages?: string[] | null;
  [key: string]: unknown;
};

/**
 * Public status of a conversion. A `direct` confirm comes back `completed`;
 * a `bridged` one comes back as a job (`cvj_…`) that walks these stages.
 */
export type ConversionJobStatus =
  | "pending"
  | "converting"
  | "processing_onchain"
  | "processing_to_fiat"
  | "completed"
  | "returning"
  | "returned"
  | "failed";

/** Statuses after which polling stops. */
export const TERMINAL_CONVERSION_STATUSES: readonly string[] = [
  "completed",
  "returned",
  "failed",
];

export function isTerminalConversionStatus(status: string | null | undefined): boolean {
  return TERMINAL_CONVERSION_STATUSES.includes(String(status ?? "").toLowerCase());
}

/** Short label per stage, for the progress list. `stage` carries the sentence. */
export const CONVERSION_STAGE_LABELS: Record<string, string> = {
  pending: "Accepted",
  converting: "Converting to USDC",
  processing_onchain: "Moving USDC on-chain",
  processing_to_fiat: "Converting from USDC",
  completed: "Completed",
  returning: "Returning funds",
  returned: "Returned",
  failed: "Needs support",
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
  route?: "direct" | "bridged" | string | null;
  rate_locked?: boolean | null;
  stage?: string | null;
  stages?: string[] | null;
  fee?: string | null;
  fee_status?: string | null;
  error?: string | null;
  return_reason?: string | null;
  [key: string]: unknown;
};

function normalizeRoute(raw: unknown): "direct" | "bridged" | null {
  const v = String(raw ?? "").trim().toLowerCase();
  return v === "direct" || v === "bridged" ? v : null;
}

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
    route: normalizeRoute(preview.route),
    // Absent means a pre-bridge backend, whose previews were always locked.
    rate_locked: preview.rate_locked !== false,
    destination_amount_estimated:
      String(preview.amount_to_status || "").toLowerCase() === "estimated",
    fee_status: preview.fee_status == null ? null : String(preview.fee_status),
    notice: preview.notice ? String(preview.notice) : null,
    stages: Array.isArray(preview.stages) ? preview.stages.map(String) : undefined,
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
    route: normalizeRoute(result.route) ?? fallback.route ?? null,
    rate_locked:
      typeof result.rate_locked === "boolean" ? result.rate_locked : fallback.rate_locked,
    // A bridged amount stays an estimate until the job completes.
    destination_amount_estimated:
      String(result.status || "").toLowerCase() === "completed"
        ? false
        : fallback.destination_amount_estimated,
    fee_amount: result.fee == null ? fallback.fee_amount : String(result.fee),
    fee_status: result.fee_status == null ? fallback.fee_status : String(result.fee_status),
    stage: result.stage == null ? null : String(result.stage),
    stages: Array.isArray(result.stages) ? result.stages.map(String) : fallback.stages,
    error: result.error == null ? null : String(result.error),
    return_reason: result.return_reason == null ? null : String(result.return_reason),
  };
}

function dataRecord(err: unknown): Record<string, unknown> | null {
  if (!(err instanceof ApiRequestError)) return null;
  const d = err.data;
  return d && typeof d === "object" && !Array.isArray(d) ? (d as Record<string, unknown>) : null;
}

/**
 * Turn a ledger-conversion failure into copy the user can act on.
 *
 * The backend's 422s carry structured `data` (passed through by Mboka) — the
 * supported list, the available balance — and the docs ask for those to be
 * rendered rather than replaced with a hard-coded guess.
 */
export function describeLedgerConversionError(err: unknown, fallback: string): string {
  const data = dataRecord(err);
  const message = err instanceof Error ? err.message.trim() : "";

  if (err instanceof ApiRequestError && err.status === 503) {
    return (
      message ||
      "Converting Stellar USDC isn't switched on yet. Move the balance to a Base or Polygon USDC account to convert it now."
    );
  }

  if (data && String(data.code || "") === "insufficient_balance") {
    const ccy = String(data.currency || "").toUpperCase();
    const suffix = ccy ? ` ${ccy}` : "";
    const available = data.available == null ? "" : String(data.available);
    const required = data.required == null ? "" : String(data.required);
    const parts = [
      "Insufficient balance",
      available ? ` — ${available}${suffix} available` : "",
      required ? `, ${required}${suffix} needed including the provider fee` : "",
      ". Try a smaller amount.",
    ];
    return parts.join("");
  }

  if (data && Array.isArray(data.supported)) {
    const supported = data.supported.map((c) => String(c).toUpperCase()).filter(Boolean);
    const ccy = String(data.currency || "").toUpperCase();
    const lead = ccy ? `${ccy} can't be converted yet` : message || "This currency can't be converted yet";
    if (supported.length === 0) return `${lead}.`;
    return `${lead} — conversions are available for ${listCurrencies(supported)}.`;
  }

  return message || fallback;
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

  /** Poll a conversion — a bridged job (`cvj_…`) settles over minutes. */
  get(entityId: string, accountId: string, conversionId: string): Promise<LedgerConversionResult> {
    return apiEnvelope<LedgerConversionResult>(
      "GET",
      `/v1/entities/${encodeURIComponent(entityId)}/accounts/${encodeURIComponent(accountId)}/conversions/${encodeURIComponent(conversionId)}`,
    );
  },
};
