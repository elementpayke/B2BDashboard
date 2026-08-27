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
  /**
   * Merchant order id (number) or projected account-credit id (`acr_…` string)
   * when Mboka includes inbound credits in `GET /v1/transactions`.
   */
  id: number | string;
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
  /** On-chain hash when the API returns one (Stellar / EVM). Never invented. */
  tx_hash?: string | null;
  /** Optional payment memo when present; entity funding is address-only so usually null. */
  memo?: string | null;
  /** Partner FinancialAccount id for account-scoped credits. */
  financial_account_id?: string | null;
  /** Credit/event source (e.g. `stellar_payment`, `account.credited`). */
  source?: string | null;
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
    tx_hash: null,
    memo: null,
    financial_account_id: null,
    source: null,
    created_at: order.created_at,
    updated_at: order.updated_at,
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function optionalString(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const trimmed = String(value).trim();
  return trimmed ? trimmed : null;
}

function toAmount(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const raw = String(value).trim();
  if (!raw) return null;
  return Number.isFinite(Number(raw.replace(/,/g, ""))) ? raw : null;
}

function parseTransactionId(value: unknown): number | string | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (/^\d+$/.test(trimmed)) return Number(trimmed);
    return trimmed;
  }
  return null;
}

function parseDirection(value: unknown): TransactionDirection | null {
  const key = optionalString(value)?.toLowerCase();
  if (key === "in" || key === "out" || key === "unknown") return key;
  return null;
}

function parseStatus(value: unknown): TransactionStatus | null {
  const key = optionalString(value)?.toLowerCase();
  if (
    key === "processing" ||
    key === "completed" ||
    key === "failed" ||
    key === "refunded" ||
    key === "canceled" ||
    key === "frozen"
  ) {
    return key;
  }
  return null;
}

/**
 * Normalize a `GET /v1/transactions` (or detail) wire row, including projected
 * inbound account credits (`acr_…` ids) with optional `tx_hash` / `memo` /
 * `crypto_network`. Returns `null` when required fields are missing — fail
 * closed; never invents hashes, memos, or amounts.
 */
export function normalizeTransactionWire(raw: unknown): Transaction | null {
  const row = asRecord(raw);
  if (!row) return null;

  const id = parseTransactionId(row.id);
  const direction = parseDirection(row.direction) ?? "unknown";
  const status = parseStatus(row.status);
  const amount = toAmount(row.amount_fiat ?? row.amount);
  const currency = optionalString(row.currency ?? row.currency_code)?.toUpperCase();
  const createdAt = optionalString(row.created_at ?? row.createdAt ?? row.observed_at);
  const updatedAt =
    optionalString(row.updated_at ?? row.updatedAt ?? row.observed_at) ?? createdAt;

  if (id === null || !status || !amount || !currency || !createdAt || !updatedAt) {
    return null;
  }

  const paymentRaw = asRecord(row.payment);
  const payment = paymentRaw
    ? paymentFromOrderMetadata({ payment: paymentRaw })
    : null;

  const provider = optionalString(row.provider);
  let cryptoNetwork = optionalString(
    row.crypto_network ?? row.cryptoNetwork ?? row.network,
  );
  // Mboka credit projection today sets provider=stellar without crypto_network.
  if (
    !cryptoNetwork &&
    (String(provider || "").toLowerCase().includes("stellar") ||
      String(id).startsWith("acr_"))
  ) {
    cryptoNetwork = "Stellar";
  }

  return {
    id,
    direction,
    status,
    amount_fiat: amount,
    currency,
    aggregator_order_id: optionalString(row.aggregator_order_id),
    external_order_id: optionalString(row.external_order_id),
    wallet_address: optionalString(row.wallet_address ?? row.walletAddress),
    provider,
    order_type: optionalString(row.order_type) as Order["order_type"] | null,
    crypto_currency: optionalString(row.crypto_currency)?.toUpperCase() ?? null,
    crypto_network: cryptoNetwork,
    exchange_rate: optionalString(row.exchange_rate),
    psp_transaction_id: optionalString(row.psp_transaction_id),
    payment,
    tx_hash: optionalString(row.tx_hash ?? row.txHash ?? row.transaction_hash),
    memo: optionalString(row.memo),
    financial_account_id: optionalString(
      row.financial_account_id ?? row.financialAccountId ?? row.account_id,
    ),
    source: optionalString(row.source),
    created_at: createdAt,
    updated_at: updatedAt,
  };
}

export const transactionsApi = {
  // Note: the backend route does not currently accept filter/pagination
  // query params — it returns the newest 50 rows for the scoped
  // business/user. Kept for the surfaces that only ever needed that page
  // (Home "Recent activity", Wallets/Cards recents, Reports, tx detail's
  // list-cache fallback) — see listPage below for the paginated screen.
  // Rows are normalized so projected credit fields (`tx_hash`, `memo`,
  // `acr_…` ids) are kept when present and invalid rows fail closed.
  async list(): Promise<TransactionList> {
    const raw = await apiEnvelope<unknown>("GET", "/v1/transactions");
    const obj =
      raw !== null && typeof raw === "object" && !Array.isArray(raw)
        ? (raw as Record<string, unknown>)
        : null;
    const rows = Array.isArray(obj?.items)
      ? obj.items
      : Array.isArray(raw)
        ? raw
        : [];
    const items = rows
      .map((row) => normalizeTransactionWire(row))
      .filter((row): row is Transaction => row !== null);
    const total =
      typeof obj?.total === "number" && Number.isFinite(obj.total) ? obj.total : items.length;
    return { items, total };
  },

  async get(id: number | string): Promise<Transaction | null> {
    const raw = await apiEnvelope<unknown>(
      "GET",
      `/v1/transactions/${encodeURIComponent(String(id))}`,
    );
    return normalizeTransactionWire(raw);
  },

  // Server-side filtered/paginated transaction history for the dedicated
  // Transactions screen. Sources pages from `GET /v1/orders?status=&limit=
  // &offset=` (which supports them, unlike `GET /v1/transactions`) and maps
  // each row back into the Transaction shape the rest of the app renders.
  // Account credits are not on `/v1/orders`, so the first page of "all" /
  // "completed" also merges `GET /v1/account-credits` (fail open if missing).
  async listPage(params: TransactionPageParams = {}): Promise<TransactionPage> {
    const page = await ordersApi.list({
      status: params.status as OrderStatus | undefined,
      limit: params.limit,
      offset: params.offset,
    });
    let items = page.items.map(mapOrderToTransaction);
    let total = page.total;
    const offset = params.offset ?? 0;
    const status = params.status;
    const mergeCredits =
      offset === 0 && (status === undefined || status === "completed");

    if (mergeCredits) {
      try {
        const { accountCreditsApi, mapAccountCreditToTransaction } = await import(
          "./accountCredits"
        );
        const credits = await accountCreditsApi.list();
        const creditTxs = credits.items.map(mapAccountCreditToTransaction);
        const seen = new Set(items.map((row) => String(row.id)));
        const extras = creditTxs.filter((row) => !seen.has(String(row.id)));
        if (extras.length) {
          items = [...extras, ...items]
            .sort((a, b) =>
              String(b.created_at).localeCompare(String(a.created_at)),
            )
            .slice(0, page.limit);
          total += extras.length;
        }
      } catch {
        // Endpoint missing / unauthorized — keep orders-only page.
      }
    }

    return {
      items,
      total,
      limit: page.limit,
      offset: page.offset,
    };
  },
};
