import type { Transaction, TransactionStatus } from "./transactions";

// UI filter chip key -> backend status. Kept as an explicit map (rather than
// e.g. lowercasing the label) so it's obvious at a glance which backend
// statuses are actually reachable from the UI, and so adding a new backend
// status can't silently become unreachable without a visible diff here.
export const TX_FILTERS: { key: string; label: string; status: TransactionStatus | "all" }[] = [
  { key: "all", label: "All", status: "all" },
  { key: "completed", label: "Settled", status: "completed" },
  { key: "processing", label: "Pending", status: "processing" },
  { key: "failed", label: "Failed", status: "failed" },
  { key: "canceled", label: "Canceled", status: "canceled" },
  { key: "frozen", label: "Frozen", status: "frozen" },
];

export function filterTransactions(items: Transaction[], filterKey: string): Transaction[] {
  const filter = TX_FILTERS.find((f) => f.key === filterKey);
  if (!filter || filter.status === "all") return items;
  return items.filter((t) => t.status === filter.status);
}
