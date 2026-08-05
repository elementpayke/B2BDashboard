import { describe, it, expect } from "vitest";
import { filterTransactions, TX_FILTERS } from "./transactionFilters";
import type { Transaction } from "./transactions";

function tx(overrides: Partial<Transaction>): Transaction {
  return {
    id: 1,
    direction: "in",
    status: "completed",
    amount_fiat: "100",
    currency: "KES",
    aggregator_order_id: null,
    external_order_id: null,
    wallet_address: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:05:00Z",
    ...overrides,
  };
}

describe("filterTransactions", () => {
  const items = [
    tx({ id: 1, status: "completed" }),
    tx({ id: 2, status: "processing" }),
    tx({ id: 3, status: "failed" }),
    tx({ id: 4, status: "canceled" }),
    tx({ id: 5, status: "frozen" }),
  ];

  it("returns everything for the 'all' filter", () => {
    expect(filterTransactions(items, "all")).toHaveLength(5);
  });

  it("filters to exactly the matching status for each real filter key", () => {
    for (const f of TX_FILTERS) {
      if (f.status === "all") continue;
      const result = filterTransactions(items, f.key);
      expect(result.every((t) => t.status === f.status)).toBe(true);
      expect(result).toHaveLength(items.filter((t) => t.status === f.status).length);
    }
  });

  it("covers every backend status the UI can reach — canceled and frozen aren't silently dropped", () => {
    const statuses = TX_FILTERS.map((f) => f.status);
    expect(statuses).toEqual(expect.arrayContaining(["completed", "processing", "failed", "canceled", "frozen"]));
  });

  it("falls back to returning everything for an unknown filter key rather than throwing", () => {
    expect(filterTransactions(items, "not-a-real-filter")).toEqual(items);
  });
});
