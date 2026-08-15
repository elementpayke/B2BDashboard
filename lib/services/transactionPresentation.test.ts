import { describe, expect, it } from "vitest";
import {
  formatTransactionDate,
  presentTransaction,
  transactionReference,
} from "./transactionPresentation";
import type { Transaction } from "./transactions";

function transaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 42,
    direction: "out",
    status: "processing",
    amount_fiat: "128040",
    currency: "KES",
    aggregator_order_id: "YC-90de94b9-0981-52e2",
    external_order_id: null,
    wallet_address: null,
    created_at: "2026-08-14T11:32:00Z",
    updated_at: "2026-08-14T11:32:00Z",
    ...overrides,
  };
}

describe("presentTransaction", () => {
  it("leads with a provider and keeps technical IDs secondary", () => {
    const view = presentTransaction(transaction({ provider: "Acme Payments" }));

    expect(view.client).toBe("Acme Payments");
    expect(view.client).not.toContain("YC-");
    expect(view.meta).toContain("Ref YC-90de94");
    expect(view.amount).toBe("−128,040.00 KES");
    expect(view.statusLabel).toBe("Pending");
  });

  it("uses a human workflow fallback when no counterparty is returned", () => {
    expect(presentTransaction(transaction()).client).toBe("Payout · KES");
    expect(
      presentTransaction(transaction({ direction: "in", currency: "NGN" })).client,
    ).toBe("Deposit · NGN");
  });

  it("uses the external reference before aggregator and PSP references", () => {
    expect(
      transactionReference(
        transaction({
          external_order_id: "supplier-invoice-17",
          psp_transaction_id: "psp-22",
        }),
      ),
    ).toBe("supplier-invoice-17");
  });
});

describe("formatTransactionDate", () => {
  it("labels today and yesterday relative to the supplied clock", () => {
    const now = new Date(2026, 7, 14, 16, 0);
    expect(formatTransactionDate(new Date(2026, 7, 14, 14, 32).toISOString(), now)).toMatch(
      /^Today, /,
    );
    expect(formatTransactionDate(new Date(2026, 7, 13, 14, 32).toISOString(), now)).toMatch(
      /^Yesterday, /,
    );
  });

  it("handles invalid timestamps without fabricating a date", () => {
    expect(formatTransactionDate("not-a-date")).toBe("Date unavailable");
  });
});
