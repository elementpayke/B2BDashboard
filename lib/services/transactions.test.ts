import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Order } from "./orders";

vi.mock("@/lib/apiClient", () => ({
  apiEnvelope: vi.fn(),
}));

import { apiEnvelope } from "@/lib/apiClient";
import { mapOrderToTransaction, transactionsApi } from "./transactions";

const mockedApiEnvelope = vi.mocked(apiEnvelope);

function order(overrides: Partial<Order> = {}): Order {
  return {
    id: 42,
    aggregator_order_id: "YC-abc",
    external_order_id: "EXT-1",
    quote_id: "q-1",
    provider: "yellowcard",
    order_type: "OffRamp",
    status: "completed",
    provider_status: null,
    amount_fiat: "1000.00",
    currency_code: "KES",
    amount_crypto: "10.00",
    crypto_currency: "USDC",
    crypto_network: "base",
    exchange_rate: "100.00",
    psp_transaction_id: null,
    checkout_url: null,
    wallet_address: "0xabc",
    client_metadata: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:05:00Z",
    ...overrides,
  };
}

describe("mapOrderToTransaction", () => {
  it("maps OffRamp to direction out and uses currency_code as currency", () => {
    const tx = mapOrderToTransaction(order({ order_type: "OffRamp" }));
    expect(tx.direction).toBe("out");
    expect(tx.currency).toBe("KES");
    expect(tx.status).toBe("completed");
    expect(tx.id).toBe(42);
  });

  it("maps OnRamp to direction in", () => {
    expect(mapOrderToTransaction(order({ order_type: "OnRamp" })).direction).toBe("in");
  });

  it("falls back to legacy client_metadata order_type when order_type is missing", () => {
    expect(
      mapOrderToTransaction(order({ order_type: "" as never, client_metadata: { order_type: 0 } })).direction,
    ).toBe("in");
    expect(
      mapOrderToTransaction(order({ order_type: "" as never, client_metadata: { order_type: 1 } })).direction,
    ).toBe("out");
  });

  it("returns unknown direction when neither order_type nor legacy metadata is present", () => {
    expect(mapOrderToTransaction(order({ order_type: "" as never, client_metadata: null })).direction).toBe(
      "unknown",
    );
  });
});

describe("transactionsApi.listPage", () => {
  beforeEach(() => {
    mockedApiEnvelope.mockReset();
  });

  it("sources pages from GET /v1/orders and maps each row to Transaction", async () => {
    mockedApiEnvelope.mockResolvedValueOnce({
      items: [order({ id: 1, order_type: "OnRamp" }), order({ id: 2, order_type: "OffRamp" })],
      total: 25,
      limit: 10,
      offset: 10,
    });

    const page = await transactionsApi.listPage({ status: "processing", limit: 10, offset: 10 });

    expect(mockedApiEnvelope).toHaveBeenCalledWith("GET", "/v1/orders?status=processing&limit=10&offset=10");
    expect(page.total).toBe(25);
    expect(page.limit).toBe(10);
    expect(page.offset).toBe(10);
    expect(page.items).toHaveLength(2);
    expect(page.items[0]?.direction).toBe("in");
    expect(page.items[1]?.direction).toBe("out");
  });

  it("omits status from the query string when fetching all rows", async () => {
    mockedApiEnvelope.mockResolvedValueOnce({ items: [], total: 0, limit: 10, offset: 0 });
    await transactionsApi.listPage({ limit: 10, offset: 0 });
    expect(mockedApiEnvelope).toHaveBeenCalledWith("GET", "/v1/orders?limit=10&offset=0");
  });
});
