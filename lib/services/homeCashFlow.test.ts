import { describe, expect, it } from "vitest";
import {
  formatHomeCashFlowUsd,
  moneyFlowFromTransactions,
} from "./homeCashFlow";
import type { ExchangeRates } from "./dashboard";
import type { Transaction } from "./transactions";

const fx: ExchangeRates = {
  base: "USD",
  rates: { KES: 130, NGN: 1600 },
};

function tx(overrides: Partial<Transaction>): Transaction {
  return {
    id: 1,
    direction: "out",
    status: "completed",
    amount_fiat: "1300",
    currency: "KES",
    aggregator_order_id: null,
    external_order_id: null,
    wallet_address: null,
    created_at: "2026-09-01T12:00:00Z",
    updated_at: "2026-09-01T12:00:00Z",
    ...overrides,
  };
}

const now = new Date("2026-09-04T15:00:00Z");

describe("moneyFlowFromTransactions", () => {
  it("converts completed in/out amounts to USD with FX", () => {
    const flow = moneyFlowFromTransactions(
      [
        tx({ id: 1, direction: "in", amount_fiat: "1300", currency: "KES" }), // $10
        tx({ id: 2, direction: "out", amount_fiat: "3200", currency: "NGN" }), // $2
        tx({ id: 3, direction: "out", amount_fiat: "100", currency: "USD" }), // $100
      ],
      fx,
      now,
    );
    expect(flow.moneyInUsd).toBeCloseTo(10);
    expect(flow.moneyOutUsd).toBeCloseTo(102);
  });

  it("ignores non-completed and out-of-window rows", () => {
    const flow = moneyFlowFromTransactions(
      [
        tx({ status: "processing", amount_fiat: "10000", currency: "USD" }),
        tx({
          created_at: "2026-07-01T12:00:00Z",
          amount_fiat: "10000",
          currency: "USD",
        }),
      ],
      fx,
      now,
    );
    expect(flow).toEqual({ moneyInUsd: 0, moneyOutUsd: 0 });
  });

  it("fails closed when a rate is missing", () => {
    const flow = moneyFlowFromTransactions(
      [tx({ currency: "GHS", amount_fiat: "100", direction: "in" })],
      fx,
      now,
    );
    expect(flow).toEqual({ moneyInUsd: null, moneyOutUsd: null });
  });

  it("does not sum raw mixed fiats as dollars", () => {
    // Regression: summary used to return 840 = 300 KES + 540 NGN labeled `$840`.
    const flow = moneyFlowFromTransactions(
      [
        tx({ id: 1, direction: "in", amount_fiat: "300", currency: "KES" }),
        tx({ id: 2, direction: "in", amount_fiat: "540", currency: "NGN" }),
      ],
      fx,
      now,
    );
    expect(flow.moneyInUsd).toBeCloseTo(300 / 130 + 540 / 1600);
    expect(flow.moneyInUsd).not.toBe(840);
  });
});

describe("formatHomeCashFlowUsd", () => {
  it("formats finite USD and dashes unknowns", () => {
    expect(formatHomeCashFlowUsd(102)).toBe("$102");
    expect(formatHomeCashFlowUsd(0)).toBe("$0");
    expect(formatHomeCashFlowUsd(null)).toBe("—");
  });
});
