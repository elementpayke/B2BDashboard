import { apiEnvelope } from "@/lib/apiClient";

export type AccountBlock = {
  accountType: "momo" | "bank" | "till" | "paybill";
  accountNumber: string;
  accountName: string;
  networkId?: string;
  countryCode?: string;
};

export type OffRampQuoteIn = {
  order_type: "OffRamp";
  currency: string;
  country: string;
  crypto_amount: string;
  refund_address: string;
  destination: AccountBlock;
  token?: string;
  external_order_id?: string;
};

export type AmountWithCurrency = { amount: string; currency: string; network: string | null };

export type QuoteAmounts = {
  rate: string | null;
  rate_currency: string | null;
  user_pays: AmountWithCurrency;
  user_receives: AmountWithCurrency;
  fees: Record<string, unknown> | null;
};

export type OrderQuote = {
  quote_id: string;
  provider: string;
  order_type: "OnRamp" | "OffRamp";
  status: string;
  expires_at: string | null;
  amounts: QuoteAmounts;
  instructions: { available_after_accept: boolean; note: string };
  form_schema: Record<string, unknown> | null;
};

export type AcceptedOrder = {
  order_id: string;
  order_type: "OnRamp" | "OffRamp";
  amount_fiat: string;
  currency: string;
  amount_crypto: string | null;
  crypto_currency: string | null;
  crypto_network: string | null;
  wallet_address: string | null;
  exchange_rate: string | null;
  psp_transaction_id: string | null;
};

export type PaymentInstructions = {
  type: "momo" | "crypto_deposit" | "bank";
  source?: Record<string, unknown> | null;
  bank_info?: Record<string, unknown> | null;
  reference?: string | null;
  account_number?: string | null;
  bank_name?: string | null;
  account_holder_name?: string | null;
  wallet_address?: string | null;
  amount?: string | null;
  currency?: string | null;
  network?: string | null;
  expires_at?: string | null;
};

export type OrderAccept = {
  merchant_order_id: number;
  quote_id: string;
  provider: string;
  status: "processing";
  order: AcceptedOrder;
  payment_instructions: PaymentInstructions;
};

// Mboka's six canonical order statuses (app/services/orders/status.py
// ALL_ORDER_STATUSES). `completed`, `failed`, `refunded`, `canceled` are
// terminal; `frozen` requires manual review and can still resolve later.
export type OrderStatus = "processing" | "completed" | "failed" | "refunded" | "canceled" | "frozen";

// GET /v1/orders/{merchant_order_id} response (ORDER_FLOW.md "Step 3: Read Order").
export type Order = {
  id: number;
  aggregator_order_id: string | null;
  external_order_id: string | null;
  quote_id: string;
  provider: string;
  order_type: "OnRamp" | "OffRamp";
  status: OrderStatus;
  provider_status: string | null;
  amount_fiat: string;
  currency_code: string;
  amount_crypto: string | null;
  crypto_currency: string | null;
  crypto_network: string | null;
  exchange_rate: string | null;
  psp_transaction_id: string | null;
  checkout_url: string | null;
  wallet_address: string | null;
  client_metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export const ordersApi = {
  quote: (payload: OffRampQuoteIn) => apiEnvelope<OrderQuote>("POST", "/v1/orders/quote", payload),
  getQuote: (quoteId: string) => apiEnvelope<OrderQuote>("GET", `/v1/orders/quote/${quoteId}`),
  accept: (quoteId: string, paymentMethod?: Record<string, unknown>) =>
    apiEnvelope<OrderAccept>("POST", `/v1/orders/${quoteId}/accept`, { payment_method: paymentMethod ?? null }),
  // Post-accept status read, used for polling (see lib/hooks/useOrderStatus.ts).
  get: (merchantOrderId: number | string) => apiEnvelope<Order>("GET", `/v1/orders/${merchantOrderId}`),
};

const RAIL_TYPE_TO_ACCOUNT_TYPE: Record<string, AccountBlock["accountType"]> = {
  mobile: "momo",
  bank: "bank",
};

/**
 * Builds the OffRamp quote payload for the "Send money -> by country" flow.
 * `railType` is the send-modal rail's `type` ("mobile" | "bank") — anything
 * else throws rather than silently defaulting, since guessing a rail here
 * could route a payout down the wrong corridor.
 */
/**
 * Render a quote's fee breakdown as a single line.
 *
 * Sums the USD components. When the provider quotes no explicit fee we say
 * "Included in the rate" rather than "$0.00" — the spread is already in the
 * exchange rate, so promising a zero fee would be untrue.
 *
 * Exists because the review step previously rendered `JSON.stringify(fees)`,
 * showing customers `{"network_fee_usd":null,...}` on a real payout.
 */
export function formatQuoteFees(fees: Record<string, unknown> | null): string {
  const total = Object.entries(fees ?? {})
    .filter(([key]) => key.endsWith("_usd"))
    .reduce((sum, [, value]) => {
      const n = Number(value);
      return value == null || Number.isNaN(n) ? sum : sum + n;
    }, 0);

  return total > 0 ? `$${total.toFixed(2)}` : "Included in the rate";
}

/**
 * Convert a locally-formatted mobile number to E.164.
 *
 * The corridor rejects anything else — a KE payout typed as the UI's own
 * placeholder ("0712 345 678") comes back as "Invalid phone number for this
 * corridor, expected_dial_code 254". Applied to mobile rails only: a bank
 * account number can legitimately start with 0, and rewriting it would send
 * money to a different account.
 *
 * Returns the input unchanged when no dial code is known, so an unmapped
 * country surfaces the provider's error rather than a number we invented.
 */
export function toE164(raw: string, dialCode?: string): string {
  const trimmed = raw.trim();
  if (!dialCode) return trimmed;

  if (trimmed.startsWith("+")) return trimmed.replace(/[^\d+]/g, "");

  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return trimmed;

  if (digits.startsWith("00" + dialCode)) return `+${digits.slice(2)}`;
  if (digits.startsWith(dialCode)) return `+${digits}`;
  // National format: a single trunk "0" is dropped before the country code.
  return `+${dialCode}${digits.replace(/^0+/, "")}`;
}

export function buildSendQuotePayload(params: {
  currency: string;
  countryIso: string; // 2-letter, any case
  railType: string;
  recipientAccountNumber: string;
  recipientName: string;
  amount: string;
  refundAddress: string;
  /** Country calling code, digits only (e.g. "254"). Mobile rails only. */
  dialCode?: string;
}): OffRampQuoteIn {
  const accountType = RAIL_TYPE_TO_ACCOUNT_TYPE[params.railType];
  if (!accountType) {
    throw new Error(`Unsupported rail type for a payout: "${params.railType}"`);
  }
  const accountNumber =
    params.railType === "mobile"
      ? toE164(params.recipientAccountNumber, params.dialCode)
      : params.recipientAccountNumber;
  return {
    order_type: "OffRamp",
    currency: params.currency.toUpperCase(),
    country: params.countryIso.toUpperCase(),
    crypto_amount: params.amount,
    refund_address: params.refundAddress,
    destination: {
      accountType,
      accountNumber,
      accountName: params.recipientName,
      countryCode: params.countryIso.toUpperCase(),
    },
  };
}
