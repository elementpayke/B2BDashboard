import { apiEnvelope, type RequestOptions } from "@/lib/apiClient";
import { newIdempotencyKey } from "@/lib/services/orders";
import { toAssetNetwork, toPartnerNetwork } from "@/lib/services/entities";
import { StrKey } from "@stellar/stellar-sdk";

/**
 * Phase 4 stablecoin sends — partner-aligned preview → confirm.
 *
 * Endpoints (Mboka):
 * - `POST /v1/accounts/{account_id}/sends/preview`
 * - `POST /v1/accounts/{account_id}/sends` (Idempotency-Key REQUIRED, 8–64 chars)
 * - `GET /v1/accounts/{account_id}/sends/{send_id}`
 *
 * Stellar USDC: any funded `G…` with a Circle USDC trustline. Mboka validates
 * StrKey destinations; the aggregator submits a Horizon payment from the
 * Element-custodial account secret.
 *
 * See `Mboka-Backend/docs/implementation/PHASE_4.md` and `app/schema/sends.py`.
 */

export const SEND_STABLECOIN_NETWORKS = [
  { key: "base", label: "Base" },
  { key: "polygon", label: "Polygon" },
  { key: "stellar", label: "Stellar" },
] as const;

export type SendStablecoinNetworkKey = (typeof SEND_STABLECOIN_NETWORKS)[number]["key"];

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
/** Stellar account StrKey: G + 55 Crockford base32 chars (56 total). */
const STELLAR_ADDRESS_RE = /^G[A-Z2-7]{55}$/;
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

export function validateStellarAddress(address: string): string {
  const value = address.trim().toUpperCase();
  if (!STELLAR_ADDRESS_RE.test(value) || !StrKey.isValidEd25519PublicKey(value)) {
    throw new Error("Enter a valid Stellar public key (G followed by 55 characters).");
  }
  return value;
}

export function validateSendAddress(address: string, networkKey: string): string {
  const network = toPartnerNetwork(networkKey);
  if (network === "Stellar") return validateStellarAddress(address);
  if (network === "Base" || network === "Polygon") return validateEvmAddress(address);
  throw new Error("Sends support Base, Polygon, and Stellar only.");
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
  /** Account's API network so stellar_testnet is not rewritten as Stellar. */
  accountNetwork?: string;
}): AccountSendPreviewIn {
  const network = toAssetNetwork(params.accountNetwork || params.networkKey);
  if (!toPartnerNetwork(network)) {
    throw new Error("Sends support Base, Polygon, and Stellar only.");
  }
  return {
    to_address: validateSendAddress(params.toAddress, params.networkKey),
    amount: validateSendAmount(params.amount),
    network,
  };
}

export function sendCryptoRecipientPlaceholder(networkKey: string): string {
  return toPartnerNetwork(networkKey) === "Stellar"
    ? "G… (Stellar public key)"
    : "0x… (EVM address)";
}

/** Keep legacy EVM-only rejection copy readable if an older API is still live. */
export function explainAccountSendError(message: string, networkKey: string): string {
  if (toPartnerNetwork(networkKey) !== "Stellar") return message;
  if (/20-byte EVM|0x EVM|must be Base or Polygon$/i.test(message)) {
    return "Stellar USDC sends need a backend that accepts G… destinations. Retry after the send API is updated, or contact support.";
  }
  return message;
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
