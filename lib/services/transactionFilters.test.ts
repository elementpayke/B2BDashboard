import { describe, it, expect } from "vitest";
import {
  filterTransactions,
  searchTransactions,
  TX_FILTERS,
} from "./transactionFilters";
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

describe("searchTransactions", () => {
  const items = [
    tx({
      id: 1,
      direction: "in",
      provider: "Acme Payments",
      currency: "KES",
      created_at: "2026-08-13T12:00:00Z",
    }),
    tx({
      id: 2,
      direction: "out",
      status: "processing",
      external_order_id: "supplier-77",
      currency: "NGN",
      created_at: "2026-07-01T12:00:00Z",
    }),
  ];

  it("filters incoming and outgoing directions without changing status semantics", () => {
    expect(searchTransactions(items, { primary: "incoming" }).map((item) => item.id)).toEqual([1]);
    expect(searchTransactions(items, { primary: "outgoing" }).map((item) => item.id)).toEqual([2]);
  });

  it("searches provider and reference fields case-insensitively", () => {
    expect(
      searchTransactions(items, { primary: "all", query: "ACME" }).map((item) => item.id),
    ).toEqual([1]);
    expect(
      searchTransactions(items, { primary: "all", query: "supplier-77" }).map(
        (item) => item.id,
      ),
    ).toEqual([2]);
  });

  it("combines currency and date filters against the latest transaction set", () => {
    expect(
      searchTransactions(items, {
        primary: "all",
        currency: "KES",
        dateRange: "7d",
        now: new Date("2026-08-14T12:00:00Z"),
      }).map((item) => item.id),
    ).toEqual([1]);
  });
});
