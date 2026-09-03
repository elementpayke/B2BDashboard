import { describe, it, expect } from "vitest";
import type { Order } from "@/lib/services/orders";
import {
  encodeSseEvent,
  orderStatusChanged,
  parseOrderWatchIds,
  shouldEndOrderWatch,
} from "./orderWatchStream";

function order(id: number, status: Order["status"]): Order {
  return {
    id,
    aggregator_order_id: null,
    external_order_id: null,
    quote_id: "q",
    provider: "test",
    order_type: "OffRamp",
    status,
    provider_status: null,
    amount_fiat: "10",
    currency_code: "KES",
    amount_crypto: "1",
    crypto_currency: "USDT",
    crypto_network: "Polygon",
    exchange_rate: "1",
    psp_transaction_id: null,
    checkout_url: null,
    wallet_address: null,
    client_metadata: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}

describe("parseOrderWatchIds", () => {
  it("parses unique positive ids", () => {
    expect(parseOrderWatchIds("12, 34,12,0,-1")).toEqual([12, 34]);
  });

  it("caps the number of ids", () => {
    const raw = Array.from({ length: 20 }, (_, i) => String(i + 1)).join(",");
    expect(parseOrderWatchIds(raw)).toHaveLength(10);
  });
});

describe("orderStatusChanged", () => {
  it("fires only when status changes", () => {
    const last = new Map<number, string>();
    expect(orderStatusChanged(last, order(1, "processing"))).toBe(true);
    expect(orderStatusChanged(last, order(1, "processing"))).toBe(false);
    expect(orderStatusChanged(last, order(1, "completed"))).toBe(true);
  });
});

describe("shouldEndOrderWatch", () => {
  it("ends when every watched id is terminal", () => {
    const last = new Map<number, string>([
      [1, "completed"],
      [2, "failed"],
    ]);
    expect(shouldEndOrderWatch([1, 2], last)).toBe(true);
  });

  it("keeps running while any id is non-terminal", () => {
    const last = new Map<number, string>([[1, "processing"]]);
    expect(shouldEndOrderWatch([1], last)).toBe(false);
  });
});

describe("encodeSseEvent", () => {
  it("serializes SSE data lines", () => {
    expect(encodeSseEvent({ type: "done" })).toBe('data: {"type":"done"}\n\n');
  });
});
