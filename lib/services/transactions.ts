import { apiEnvelope } from "@/lib/apiClient";
import { ordersApi, type Order, type OrderStatus } from "./orders";

// Mboka-normalized status values — all 6 canonical order statuses, since a
// transaction is a read-view over merchant_orders (app/services/orders/status.py
// ALL_ORDER_STATUSES). "refunded" was missing here, which meant a refunded
// order silently fell through to the TX_STATUS_DISPLAY "Unknown" fallback.
export type TransactionStatus = "processing" | "completed" | "failed" | "refunded" | "canceled" | "frozen";
export type TransactionDirection = "in" | "out" | "unknown";

/** Fiat-rail counterparty for receipts / transaction detail. */
export type TransactionPayment = {
  party_name?: string | null;
  account_name?: string | null;
  /** Bank account number or mobile-money MSISDN. */
  account_number?: string | null;
  account_kind?: "phone" | "bank_account" | string | null;
  method_type?: "mobile_money" | "bank" | string | null;
  network_id?: string | null;
  /** Human rail label when known (e.g. M-PESA). */
  network_name?: string | null;
};

export type Transaction = {
  id: number;
  direction: TransactionDirection;
  status: TransactionStatus;
  amount_fiat: string;
  currency: string;
  aggregator_order_id: string | null;
  external_order_id: string | null;
  wallet_address: string | null;
  provider?: string | null;
  order_type?: Order["order_type"] | null;
  crypto_currency?: string | null;
  crypto_network?: string | null;
  exchange_rate?: string | null;
  psp_transaction_id?: string | null;
  payment?: TransactionPayment | null;
  created_at: string;
  updated_at: string;
};

export type TransactionList = {
  items: Transaction[];
  total: number;
};

// A server-filtered/paginated page, sourced from `GET /v1/orders` (see
// mapOrderToTransaction below) rather than `GET /v1/transactions`, which
// accepts no query params. Mirrors OrderList's shape so callers can tell
// how far into the full result set the current page sits.
export type TransactionPage = {
  items: Transaction[];
  total: number;
  limit: number;
  offset: number;
};

export type TransactionPageParams = {
  /** Omit for "all" (the backend has no wildcard status value). */
  status?: TransactionStatus;
  limit?: number;
  offset?: number;
};

/**
 * `OrderOut` has no `direction` field — mirrors the backend's own
 * projection (`app/domain/order_direction.py`): the `order_type` column
 * (`OnRamp`/`OffRamp`) wins, falling back to the legacy numeric
 * `client_metadata.order_type` (`0`/`1`) for rows that predate that column.
 */
function directionFromOrder(order: Order): TransactionDirection {
  const type = order.order_type?.trim().toLowerCase();
  if (type === "onramp") return "in";
  if (type === "offramp") return "out";
  const legacy = (order.client_metadata as Record<string, unknown> | null)?.["order_type"];
  if (legacy === 0 || legacy === "0") return "in";
  if (legacy === 1 || legacy === "1") return "out";
  return "unknown";
}

/**
 * Prefer first-class `payment` on TransactionOut; fall back to the accept-time
 * snapshot under `client_metadata.payment` on OrderOut.
 */
export function paymentFromOrderMetadata(
  metadata: Record<string, unknown> | null | undefined,
): TransactionPayment | null {
  const raw = metadata?.["payment"];
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;
  const out: TransactionPayment = {
    party_name: typeof p.party_name === "string" ? p.party_name : null,
    account_name: typeof p.account_name === "string" ? p.account_name : null,
    account_number: typeof p.account_number === "string" ? p.account_number : null,
    account_kind: typeof p.account_kind === "string" ? p.account_kind : null,
    method_type: typeof p.method_type === "string" ? p.method_type : null,
    network_id: typeof p.network_id === "string" ? p.network_id : null,
    network_name: typeof p.network_name === "string" ? p.network_name : null,
  };
  if (
    !out.party_name &&
    !out.account_number &&
    !out.method_type &&
    !out.network_name
  ) {
    return null;
  }
  return out;
}

/**
 * `GET /v1/orders` and `GET /v1/transactions` are both thin views over the
 * same `merchant_orders` row (same `id` — safe to pass into
 * `transactionsApi.get`/`useOrderStatus` interchangeably); only the wire
 * shape and the list endpoint's filter/pagination support differ. See
 * docs/api-contract.md "Transaction history filters & pagination".
 */
export function mapOrderToTransaction(order: Order): Transaction {
  return {
    id: order.id,
    direction: directionFromOrder(order),
    status: order.status,
    amount_fiat: order.amount_fiat,
    currency: order.currency_code,
    aggregator_order_id: order.aggregator_order_id,
    external_order_id: order.external_order_id,
    wallet_address: order.wallet_address,
    provider: order.provider,
    order_type: order.order_type,
    crypto_currency: order.crypto_currency,
    crypto_network: order.crypto_network,
    exchange_rate: order.exchange_rate,
    psp_transaction_id: order.psp_transaction_id,
    payment: paymentFromOrderMetadata(order.client_metadata),
    created_at: order.created_at,
    updated_at: order.updated_at,
  };
}

export const transactionsApi = {
  // Note: the backend route does not currently accept filter/pagination
  // query params — it returns the newest 50 rows for the scoped
  // business/user. Kept for the surfaces that only ever needed that page
  // (Home "Recent activity", Wallets/Cards recents, Reports, tx detail's
  // list-cache fallback) — see listPage below for the paginated screen.
  list: () => apiEnvelope<TransactionList>("GET", "/v1/transactions"),
  get: (id: number) => apiEnvelope<Transaction>("GET", `/v1/transactions/${id}`),

  // Server-side filtered/paginated transaction history for the dedicated
  // Transactions screen. Sources pages from `GET /v1/orders?status=&limit=
  // &offset=` (which supports them, unlike `GET /v1/transactions`) and maps
  // each row back into the Transaction shape the rest of the app renders.
  async listPage(params: TransactionPageParams = {}): Promise<TransactionPage> {
    const page = await ordersApi.list({
      status: params.status as OrderStatus | undefined,
      limit: params.limit,
      offset: params.offset,
    });
    return {
      items: page.items.map(mapOrderToTransaction),
      total: page.total,
      limit: page.limit,
      offset: page.offset,
    };
  },
};
