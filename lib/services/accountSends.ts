import { apiEnvelope, type RequestOptions } from "@/lib/apiClient";
import { newIdempotencyKey } from "@/lib/services/orders";
import { toPartnerNetwork } from "@/lib/services/entities";

/**
 * Phase 4 stablecoin sends — partner-aligned preview → confirm.
 *
 * Endpoints (Mboka):
 * - `POST /v1/accounts/{account_id}/sends/preview`
 * - `POST /v1/accounts/{account_id}/sends` (Idempotency-Key REQUIRED, 8–64 chars)
 * - `GET /v1/accounts/{account_id}/sends/{send_id}`
 *
 * See `Mboka-Backend/docs/implementation/PHASE_4.md` and `app/schema/sends.py`.
 */

export type AccountSend = {
  id: string;
  status: string;
  account_id: string;
  currency: string;
  network: string;
  to_address: string;
  amount: string;
  fee_amount: string | null;
  receive_amount: string | null;
  preview_token: string | null;
  provider_send_id: string | null;
  ledger_journal_reference: string | null;
  expires_at: string | null;
};

export type AccountSendPreviewIn = {
  to_address: string;
  amount: string;
  network?: string;
};

export type AccountSendConfirmIn = {
  preview_token: string;
};

const EVM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const MIN_AMOUNT = 1;

function idempotencyHeaders(key: string): RequestOptions {
  return { headers: { "Idempotency-Key": key } };
}

export function validateEvmAddress(address: string): string {
  const value = address.trim();
  if (!EVM_ADDRESS_RE.test(value)) {
    throw new Error("Enter a valid 0x EVM wallet address (40 hex chars).");
  }
  return value;
}

/** Min 1.00 USDC per Phase 4 / partner contract. */
export function validateSendAmount(amount: string): string {
  const trimmed = amount.trim().replace(/,/g, "");
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < MIN_AMOUNT) {
    throw new Error(`Minimum send amount is ${MIN_AMOUNT.toFixed(2)} USDC.`);
  }
  // Keep a plain decimal string for the backend Decimal field.
  return trimmed;
}

export function buildSendPreviewPayload(params: {
  toAddress: string;
  amount: string;
  networkKey: string;
}): AccountSendPreviewIn {
  const network = toPartnerNetwork(params.networkKey);
  if (!network) {
    throw new Error("Sends support Base and Polygon only.");
  }
  return {
    to_address: validateEvmAddress(params.toAddress),
    amount: validateSendAmount(params.amount),
    network,
  };
}

export const accountSendsApi = {
  preview: (accountId: string, payload: AccountSendPreviewIn) =>
    apiEnvelope<AccountSend>(
      "POST",
      `/v1/accounts/${encodeURIComponent(accountId)}/sends/preview`,
      payload,
    ),

  /**
   * Confirm a previewed send. `idempotencyKey` is REQUIRED by the backend
   * (ValidationError if missing) and must be 8–64 characters.
   */
  confirm: (accountId: string, payload: AccountSendConfirmIn, idempotencyKey: string) =>
    apiEnvelope<AccountSend>(
      "POST",
      `/v1/accounts/${encodeURIComponent(accountId)}/sends`,
      payload,
      idempotencyHeaders(idempotencyKey),
    ),

  get: (accountId: string, sendId: string) =>
    apiEnvelope<AccountSend>(
      "GET",
      `/v1/accounts/${encodeURIComponent(accountId)}/sends/${encodeURIComponent(sendId)}`,
    ),
};

export { newIdempotencyKey };
