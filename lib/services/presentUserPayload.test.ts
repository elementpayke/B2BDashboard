import { describe, expect, it, vi, beforeEach } from "vitest";
import { presentTransaction } from "./transactionPresentation";
import {
  mapOrderToTransaction,
  mergeTransactionPreferPayment,
  normalizeTransactionWire,
  transactionsApi,
} from "./transactions";
import type { Order } from "./orders";
import { apiEnvelope } from "@/lib/apiClient";

vi.mock("@/lib/apiClient", () => ({
  apiEnvelope: vi.fn(),
}));

const mockedApiEnvelope = vi.mocked(apiEnvelope);

const payment = {
  party_name: "test trader",
  account_number: "9033674150",
  account_kind: "bank_account",
  method_type: "bank",
  network_id: "344f1324-11fb-4875-bd74-fbb43cd2b32d",
};

const payload = {
  id: 20,
  direction: "out",
  status: "completed",
  amount_fiat: "2720.000000",
  currency: "NGN",
  aggregator_order_id: "YC-498dcd59-10e5-5a1c-8284-560bf2cbd939",
  external_order_id: null,
  wallet_address: "0xa29D2aE45488EC11E024F83b6bb74C595eEba7E1",
  provider: "yellowcard",
  order_type: "OffRamp",
  psp_transaction_id: "partner_send:10",
  payment,
  created_at: "2026-09-04T12:05:41",
  updated_at: "2026-09-04T12:08:32",
};

function order(overrides: Partial<Order> = {}): Order {
  return {
    id: 20,
    aggregator_order_id: payload.aggregator_order_id,
    external_order_id: null,
    quote_id: "q",
    provider: "yellowcard",
    order_type: "OffRamp",
    status: "completed",
    provider_status: null,
    amount_fiat: payload.amount_fiat,
    currency_code: "NGN",
    amount_crypto: null,
    crypto_currency: null,
    crypto_network: "POLYGON",
    exchange_rate: null,
    psp_transaction_id: "partner_send:10",
    checkout_url: null,
    wallet_address: payload.wallet_address,
    client_metadata: null,
    created_at: payload.created_at,
    updated_at: payload.updated_at,
    ...overrides,
  };
}

describe("user payload smoke", () => {
  it("normalizes and presents recipient name from /v1/transactions", () => {
    const tx = normalizeTransactionWire(payload);
    expect(tx?.payment?.party_name).toBe("test trader");
    const view = presentTransaction(tx!);
    expect(view.client).toBe("test trader");
    expect(view.partyName).toBe("test trader");
    expect(view.accountNumber).toBe("9033674150");
  });

  it("maps order client_metadata.payment the same way", () => {
    const tx = mapOrderToTransaction(order({ client_metadata: { payment } }));
    expect(presentTransaction(tx).client).toBe("test trader");
  });

  it("keeps prior payment when an order status patch omits it", () => {
    const withPayment = normalizeTransactionWire(payload)!;
    const wiped = mapOrderToTransaction(order({ client_metadata: { origin_system: "mboka" } }));
    expect(wiped.payment).toBeNull();
    const merged = mergeTransactionPreferPayment(withPayment, { ...withPayment, ...wiped });
    expect(merged.payment?.party_name).toBe("test trader");
    expect(presentTransaction(merged).client).toBe("test trader");
  });
});

describe("transactionsApi.listPage payment enrichment", () => {
  beforeEach(() => {
    mockedApiEnvelope.mockReset();
  });

  it("copies payment from /v1/transactions when orders omit the snapshot", async () => {
    mockedApiEnvelope
      .mockResolvedValueOnce({
        items: [order({ id: 20, client_metadata: { origin_system: "mboka" } })],
        total: 1,
        limit: 10,
        offset: 0,
      })
      .mockRejectedValueOnce(new Error("no credits"))
      .mockResolvedValueOnce({ items: [payload], total: 1 });

    const page = await transactionsApi.listPage({ limit: 10, offset: 0 });
    expect(page.items[0]?.payment?.party_name).toBe("test trader");
    expect(presentTransaction(page.items[0]!).client).toBe("test trader");
  });
});
