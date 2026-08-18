import type { Transaction, TransactionStatus } from "./transactions";
import { describeTransactionStatus } from "./transactionStatus";

// UI filter chip key -> backend status. Kept as an explicit map (rather than
// e.g. lowercasing the label) so it's obvious at a glance which backend
// statuses are actually reachable from the UI, and so adding a new backend
// status can't silently become unreachable without a visible diff here.
export const TX_FILTERS: { key: string; label: string; status: TransactionStatus | "all" }[] = [
  { key: "all", label: "All", status: "all" },
  ...(["completed", "processing", "failed", "refunded", "canceled", "frozen"] as const).map(
    (status) => ({
      key: status,
      label: describeTransactionStatus(status).label,
      status,
    }),
  ),
];

export type PrimaryTransactionFilter =
  | "all"
  | "incoming"
  | "outgoing"
  | "processing"
  | "failed";

export const PRIMARY_TX_FILTERS: {
  key: PrimaryTransactionFilter;
  label: string;
}[] = [
  { key: "all", label: "All" },
  { key: "incoming", label: "Incoming" },
  { key: "outgoing", label: "Outgoing" },
  { key: "processing", label: "Pending" },
  { key: "failed", label: "Failed" },
];

export type TransactionSearchCriteria = {
  primary: PrimaryTransactionFilter;
  query?: string;
  currency?: string;
  dateRange?: "all" | "7d" | "30d";
  now?: Date;
};

export function searchTransactions(
  items: Transaction[],
  criteria: TransactionSearchCriteria,
): Transaction[] {
  const query = criteria.query?.trim().toLowerCase() ?? "";
  const currency = criteria.currency?.toUpperCase();
  const dateRange = criteria.dateRange ?? "all";
  const now = criteria.now ?? new Date();
  const days = dateRange === "7d" ? 7 : dateRange === "30d" ? 30 : null;
  const earliest = days === null ? null : now.getTime() - days * 24 * 60 * 60 * 1000;

  return items.filter((transaction) => {
    if (criteria.primary === "incoming" && transaction.direction !== "in") return false;
    if (criteria.primary === "outgoing" && transaction.direction !== "out") return false;
    if (
      (criteria.primary === "processing" || criteria.primary === "failed") &&
      transaction.status !== criteria.primary
    ) {
      return false;
    }
    if (currency && currency !== "ALL" && transaction.currency.toUpperCase() !== currency) {
      return false;
    }
    if (earliest !== null) {
      const created = new Date(transaction.created_at).getTime();
      if (!Number.isFinite(created) || created < earliest) return false;
    }
    if (!query) return true;

    return [
      transaction.id,
      transaction.external_order_id,
      transaction.aggregator_order_id,
      transaction.psp_transaction_id,
      transaction.provider,
      transaction.amount_fiat,
      transaction.currency,
    ]
      .filter((value) => value != null)
      .some((value) => String(value).toLowerCase().includes(query));
  });
}

export function filterTransactions(items: Transaction[], filterKey: string): Transaction[] {
  const filter = TX_FILTERS.find((f) => f.key === filterKey);
  if (!filter || filter.status === "all") return items;
  return items.filter((t) => t.status === filter.status);
}
