import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Order } from "./orders";

vi.mock("@/lib/apiClient", () => ({
  apiEnvelope: vi.fn(),
}));

import { apiEnvelope } from "@/lib/apiClient";
import { mapOrderToTransaction, paymentFromOrderMetadata, transactionsApi } from "./transactions";

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
    expect(tx).toMatchObject({
      provider: "yellowcard",
      crypto_currency: "USDC",
      crypto_network: "base",
      exchange_rate: "100.00",
    });
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

  it("maps client_metadata.payment including account_name-only snapshots", () => {
    const tx = mapOrderToTransaction(
      order({
        client_metadata: {
          payment: {
            account_name: "Chidi Okonkwo",
            account_number: "0123456789",
            account_kind: "bank_account",
          },
        },
      }),
    );
    expect(tx.payment).toMatchObject({
      account_name: "Chidi Okonkwo",
      account_number: "0123456789",
      account_kind: "bank_account",
    });
  });
});

describe("paymentFromOrderMetadata", () => {
  it("keeps a payment object when only account_name is present", () => {
    expect(
      paymentFromOrderMetadata({
        payment: { account_name: "Ada Lovelace" },
      }),
    ).toEqual({
      party_name: null,
      account_name: "Ada Lovelace",
      account_number: null,
      account_kind: null,
      method_type: null,
      network_id: null,
      network_name: null,
    });
  });

  it("returns null when payment has no identifying fields", () => {
    expect(paymentFromOrderMetadata({ payment: { network_id: "x" } })).toBeNull();
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
    mockedApiEnvelope
      .mockResolvedValueOnce({ items: [], total: 0, limit: 10, offset: 0 })
      .mockResolvedValueOnce({ items: [], total: 0 });
    await transactionsApi.listPage({ limit: 10, offset: 0 });
    expect(mockedApiEnvelope).toHaveBeenCalledWith("GET", "/v1/orders?limit=10&offset=0");
  });

  it("merges account credits into the first page for all/completed filters", async () => {
    mockedApiEnvelope
      .mockResolvedValueOnce({
        items: [order({ id: 1, order_type: "OffRamp", status: "completed" })],
        total: 1,
        limit: 10,
        offset: 0,
      })
      .mockResolvedValueOnce({
        items: [
          {
            id: 7,
            tx_hash: "deadbeef",
            amount: "3.00",
            currency: "USDC",
            account_id: "acc-1",
            from_address: "GFROM",
            to_address: "GTO",
            created_at: "2026-08-21T00:00:00Z",
            memo: null,
          },
        ],
        total: 1,
      });

    const page = await transactionsApi.listPage({ limit: 10, offset: 0 });

    expect(mockedApiEnvelope).toHaveBeenCalledWith("GET", "/v1/orders?limit=10&offset=0");
    expect(mockedApiEnvelope).toHaveBeenCalledWith("GET", "/v1/account-credits");
    expect(page.items.some((row) => row.id === "acr_7")).toBe(true);
    expect(page.items.find((row) => row.id === "acr_7")?.tx_hash).toBe("deadbeef");
    expect(page.total).toBe(2);
  });

  it("caps the merged first page at the page limit", async () => {
    mockedApiEnvelope
      .mockResolvedValueOnce({
        items: [
          order({
            id: 1,
            order_type: "OffRamp",
            status: "completed",
            created_at: "2026-08-20T00:00:00Z",
          }),
          order({
            id: 2,
            order_type: "OffRamp",
            status: "completed",
            created_at: "2026-08-19T00:00:00Z",
          }),
        ],
        total: 2,
        limit: 2,
        offset: 0,
      })
      .mockResolvedValueOnce({
        items: [
          {
            id: 7,
            tx_hash: "deadbeef",
            amount: "3.00",
            currency: "USDC",
            account_id: "acc-1",
            from_address: "GFROM",
            to_address: "GTO",
            created_at: "2026-08-21T00:00:00Z",
            memo: null,
          },
        ],
        total: 1,
      });

    const page = await transactionsApi.listPage({ limit: 2, offset: 0 });

    expect(page.items).toHaveLength(2);
    expect(page.items[0]?.id).toBe("acr_7");
    expect(page.items.map((row) => row.id)).not.toContain(2);
    expect(page.total).toBe(3);
  });

  it("does not merge credits onto non-completed status pages", async () => {
    mockedApiEnvelope.mockResolvedValueOnce({
      items: [order({ id: 1, order_type: "OnRamp", status: "processing" })],
      total: 1,
      limit: 10,
      offset: 0,
    });
    const page = await transactionsApi.listPage({ status: "processing", limit: 10, offset: 0 });
    expect(mockedApiEnvelope).toHaveBeenCalledTimes(1);
    expect(page.items).toHaveLength(1);
    expect(page.total).toBe(1);
  });
});
