import { apiEnvelope, ApiRequestError, type RequestOptions } from "@/lib/apiClient";

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

/**
 * OnRamp = fiat -> crypto, used by the "Deposit -> By country" flow to top
 * up the business's own treasury wallet (see ORDER_FLOW.md "Create Quote").
 * `source` is how the customer pays fiat in — for a mobile rail that's the
 * MoMo number the STK/USSD prompt goes to; for a bank rail it's the account
 * being debited.
 */
export type OnRampQuoteIn = {
  order_type: "OnRamp";
  currency: string;
  country: string;
  local_amount: string;
  wallet_address: string;
  source: AccountBlock;
  token?: string;
  external_order_id?: string;
};

export type OrderQuoteIn = OnRampQuoteIn | OffRampQuoteIn;

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

// GET /v1/orders — paginated list response. Unlike `GET /v1/transactions`
// (no query params, hard `limit=50`), this endpoint accepts and echoes back
// `status`/`limit`/`offset`, so the Transactions screen's server-side
// filtering/pagination sources pages from here — see
// lib/services/transactions.ts `listPage` and docs/api-contract.md
// "Transaction history filters & pagination".
export type OrderList = {
  items: Order[];
  total: number;
  limit: number;
  offset: number;
};

export type OrderListParams = {
  /** Exact match on the backend's 6 canonical statuses. Omit for "all". */
  status?: OrderStatus;
  /** Backend caps this at 200 (`le=200` on the route). */
  limit?: number;
  offset?: number;
};

/** Builds an `Idempotency-Key` header for a mutating orders call, or `{}`
 * when no key is supplied. Backend support: `app/routes/orders.py` accepts
 * this header on both quote and accept, replaying the original response for
 * a repeat key rather than double-creating a quote / double-charging a
 * corridor (see `Mboka-Backend/app/routes/orders.py::_replay_or_begin`). */
function idempotencyHeaders(key?: string): RequestOptions | undefined {
  return key ? { headers: { "Idempotency-Key": key } } : undefined;
}

export const ordersApi = {
  quote: (payload: OrderQuoteIn, idempotencyKey?: string) =>
    apiEnvelope<OrderQuote>("POST", "/v1/orders/quote", payload, idempotencyHeaders(idempotencyKey)),
  getQuote: (quoteId: string) => apiEnvelope<OrderQuote>("GET", `/v1/orders/quote/${quoteId}`),
  accept: (quoteId: string, paymentMethod?: Record<string, unknown>, idempotencyKey?: string) =>
    apiEnvelope<OrderAccept>(
      "POST",
      `/v1/orders/${quoteId}/accept`,
      { payment_method: paymentMethod ?? null },
      idempotencyHeaders(idempotencyKey),
    ),
  // Post-accept status read, used for polling (see lib/hooks/useOrderStatus.ts).
  get: (merchantOrderId: number | string) => apiEnvelope<Order>("GET", `/v1/orders/${merchantOrderId}`),
  list: (params: OrderListParams = {}) => {
    const qs = new URLSearchParams();
    if (params.status) qs.set("status", params.status);
    if (params.limit != null) qs.set("limit", String(params.limit));
    if (params.offset != null) qs.set("offset", String(params.offset));
    const query = qs.toString();
    return apiEnvelope<OrderList>("GET", `/v1/orders${query ? `?${query}` : ""}`);
  },
};

/**
 * A fresh random key for one quote-or-accept attempt. Callers should mint a
 * new key each time the request payload genuinely changes (new amount,
 * new corridor, a fresh quote after expiry) and reuse the same key only when
 * retrying the exact same request after a network failure — reusing it
 * across different payloads would make the backend replay a stale response
 * instead of processing the new one.
 */
export function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback for environments without `crypto.randomUUID` (older test runners).
  return `idem_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

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

type CorridorPhoneErrorData = {
  field?: unknown;
  expected_dial_code?: unknown;
  example?: unknown;
  country?: unknown;
};

export type SendQuoteErrorInfo = {
  /** Short headline — makes it clear the problem is NOT a field on this form. */
  title: string | null;
  message: string;
  /** CTA destination when the fix lives outside the send form. */
  action: "verification" | null;
};

/**
 * Turn a raw OffRamp quote rejection into copy users can act on.
 *
 * Live KE bank payouts return "Invalid phone number for this corridor" with
 * `data.field: "customer.phone_number"` even when the destination is a bank
 * account — Yellow Card validates the *business KYC phone* against the
 * destination corridor dial code. Surfacing the account number as "invalid
 * phone" is wrong for bank rails; this remaps that case.
 */
export function describeSendQuoteError(err: unknown): SendQuoteErrorInfo {
  const fallback =
    err instanceof ApiRequestError || err instanceof Error
      ? err.message
      : "Couldn't get a quote. Try again.";
  const data =
    err instanceof ApiRequestError && err.data && typeof err.data === "object"
      ? (err.data as CorridorPhoneErrorData)
      : null;

  const field = data && typeof data.field === "string" ? data.field : "";
  const dial =
    data &&
    (typeof data.expected_dial_code === "string" || typeof data.expected_dial_code === "number")
      ? String(data.expected_dial_code)
      : "";
  const example = data && typeof data.example === "string" ? data.example : "";
  const country = data && typeof data.country === "string" ? data.country.toUpperCase() : "";

  if (
    /customer\.phone_number/i.test(field) ||
    /invalid phone number for this corridor/i.test(fallback)
  ) {
    const where = country ? ` (${country})` : "";
    const need = dial
      ? ` It must use dial code +${dial}${example ? ` (e.g. ${example})` : ""}.`
      : example
        ? ` Example format: ${example}.`
        : "";
    return {
      title: "Not a field on this form",
      message: `This payout${where} was blocked by the business contact phone on your Verification profile — not the recipient account or phone above.${need} Update that business phone (or pick a corridor that matches it), then try Review again.`,
      action: "verification",
    };
  }

  return { title: null, message: fallback, action: null };
}

/** Convenience wrapper when only the message string is needed. */
export function formatSendQuoteError(err: unknown): string {
  return describeSendQuoteError(err).message;
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
  /**
   * Aggregator provider/institution id from
   * `GET /v1/supported/catalog` -> `providers[].id` for the selected
   * corridor (see `lib/services/catalog.ts`). Omitted when the catalog has
   * no match for this corridor yet — the aggregator then falls back to its
   * own default provider for the rail, same as before this was wired up.
   */
  networkId?: string;
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
      ...(params.networkId ? { networkId: params.networkId } : {}),
    },
  };
}

/**
 * Builds the OnRamp quote payload for the "Deposit -> By country" flow
 * (topping up the business's own treasury wallet via mobile money or bank).
 * Mirrors `buildSendQuotePayload`'s rail handling, but `source` is the payer
 * account (the business's own MoMo number / bank account), not a recipient.
 */
export function buildDepositQuotePayload(params: {
  currency: string;
  countryIso: string; // 2-letter, any case
  railType: string;
  /** The business's own MoMo number or bank account being debited. */
  payerAccountNumber: string;
  /** Account holder name on `payerAccountNumber` — the business's own name. */
  payerName: string;
  amount: string;
  /** EVM address the crypto lands in — the business's treasury wallet. */
  walletAddress: string;
  /** Country calling code, digits only (e.g. "254"). Mobile rails only. */
  dialCode?: string;
  /** Aggregator provider/institution id, see `buildSendQuotePayload`. */
  networkId?: string;
}): OnRampQuoteIn {
  const accountType = RAIL_TYPE_TO_ACCOUNT_TYPE[params.railType];
  if (!accountType) {
    throw new Error(`Unsupported rail type for a deposit: "${params.railType}"`);
  }
  const accountNumber =
    params.railType === "mobile"
      ? toE164(params.payerAccountNumber, params.dialCode)
      : params.payerAccountNumber;
  return {
    order_type: "OnRamp",
    currency: params.currency.toUpperCase(),
    country: params.countryIso.toUpperCase(),
    local_amount: params.amount,
    wallet_address: params.walletAddress,
    source: {
      accountType,
      accountNumber,
      accountName: params.payerName,
      countryCode: params.countryIso.toUpperCase(),
      ...(params.networkId ? { networkId: params.networkId } : {}),
    },
  };
}

export type PaymentInstructionRow = { k: string; v: string };

/**
 * Pure mapper from `payment_instructions` (returned by
 * `POST /orders/{quote_id}/accept`, ORDER_FLOW.md "Accept Response Object")
 * to display rows for the Deposit modal's bank/momo confirmation screen.
 * Discriminated on `type` per `PaymentInstructionsOut` in the backend schema
 * — only renders the fields that type actually carries, rather than
 * dumping every possibly-null field.
 */
export function buildPaymentInstructionRows(
  instructions: PaymentInstructions | null | undefined,
): PaymentInstructionRow[] {
  if (!instructions) return [];
  const rows: PaymentInstructionRow[] = [];

  if (instructions.type === "bank") {
    const bankInfo = (instructions.bank_info ?? {}) as Record<string, unknown>;
    const accountNumber = instructions.account_number ?? (bankInfo.accountNumber as string | undefined);
    const bankName = instructions.bank_name ?? (bankInfo.bankName as string | undefined);
    const holderName =
      instructions.account_holder_name ?? (bankInfo.accountHolderName as string | undefined);
    if (accountNumber) rows.push({ k: "Account number", v: String(accountNumber) });
    if (bankName) rows.push({ k: "Bank", v: String(bankName) });
    if (holderName) rows.push({ k: "Account name", v: String(holderName) });
    if (instructions.reference) rows.push({ k: "Reference", v: instructions.reference });
  } else if (instructions.type === "momo") {
    const source = (instructions.source ?? {}) as Record<string, unknown>;
    if (source.accountNumber) rows.push({ k: "Phone", v: String(source.accountNumber) });
    if (source.networkName) rows.push({ k: "Network", v: String(source.networkName) });
  } else if (instructions.type === "crypto_deposit") {
    if (instructions.wallet_address) rows.push({ k: "Address", v: instructions.wallet_address });
    if (instructions.amount) rows.push({ k: "Amount", v: String(instructions.amount) });
    if (instructions.currency) rows.push({ k: "Asset", v: instructions.currency });
    if (instructions.network) rows.push({ k: "Network", v: instructions.network });
  }

  if (instructions.expires_at) {
    rows.push({ k: "Expires", v: new Date(instructions.expires_at).toLocaleString() });
  }

  return rows;
}

/**
 * `POST /orders/{quote_id}/accept` returns 410 once the quote has expired
 * server-side (see `Mboka-Backend/docs/api/ORDER_FLOW.md` "Errors FE
 * Should Branch On"). The contract is "re-quote with the same inputs", not
 * "retry the same accept" — the quote_id is dead.
 */
export function isQuoteExpiredError(err: unknown): boolean {
  return err instanceof ApiRequestError && err.status === 410;
}

/**
 * 409 on accept means a duplicate request (e.g. a double-click) already
 * produced an order for this exact quote_id — not a failure to surface as
 * an error, since the payout did go through.
 */
export function isQuoteAlreadyAcceptedError(err: unknown): boolean {
  return err instanceof ApiRequestError && err.status === 409;
}
