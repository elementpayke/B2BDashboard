import { apiEnvelope } from "@/lib/apiClient";

// Mboka-normalized status values (backend: processing/completed/failed/canceled/frozen).
export type TransactionStatus = "processing" | "completed" | "failed" | "canceled" | "frozen";
export type TransactionDirection = "in" | "out" | "unknown";

export type Transaction = {
  id: number;
  direction: TransactionDirection;
  status: TransactionStatus;
  amount_fiat: string;
  currency: string;
  aggregator_order_id: string | null;
  external_order_id: string | null;
  wallet_address: string | null;
  created_at: string;
  updated_at: string;
};

export type TransactionList = {
  items: Transaction[];
  total: number;
};

export const transactionsApi = {
  // Note: the backend route does not currently accept filter/pagination
  // query params — it returns the full scoped list. Filtering by status
  // happens client-side (see lib/services/transactionFilters.ts).
  list: () => apiEnvelope<TransactionList>("GET", "/v1/transactions"),
  get: (id: number) => apiEnvelope<Transaction>("GET", `/v1/transactions/${id}`),
};
