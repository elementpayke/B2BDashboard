import { describe, expect, it } from "vitest";
import { recentActivityForFinancialAccount } from "./accountCredits";
import type { Transaction } from "./transactions";

function tx(overrides: Partial<Transaction>): Transaction {
  return {
    id: 1,
    direction: "in",
    status: "completed",
    amount_fiat: "10",
    currency: "USDC",
    aggregator_order_id: null,
    external_order_id: null,
    wallet_address: null,
    created_at: "2026-08-20T12:00:00Z",
    updated_at: "2026-08-20T12:00:00Z",
    ...overrides,
  };
}

describe("recentActivityForFinancialAccount", () => {
  it("keeps the unfiltered feed when no rows carry financial_account_id", () => {
    const items = [
      tx({ id: 1, currency: "KES" }),
      tx({ id: 2, currency: "USDC", crypto_network: "stellar_testnet" }),
    ];
    expect(recentActivityForFinancialAccount(items, "acct_stellar")).toEqual(items);
  });

  it("scopes to matching financial_account_id when the API provides it", () => {
    const items = [
      tx({
        id: "acr_other",
        financial_account_id: "acct_other",
        crypto_network: "stellar_testnet",
        tx_hash: "h1",
      }),
      tx({
        id: "acr_mine",
        financial_account_id: "acct_stellar",
        crypto_network: "stellar_testnet",
        tx_hash: "h2",
      }),
      tx({ id: 9, financial_account_id: null }),
    ];
    expect(recentActivityForFinancialAccount(items, "acct_stellar")).toEqual([
      items[1],
    ]);
  });

  it("returns an empty list when scoped ids exist but none match this wallet", () => {
    const items = [
      tx({
        id: "acr_other",
        financial_account_id: "acct_other",
        crypto_network: "stellar_testnet",
      }),
    ];
    expect(recentActivityForFinancialAccount(items, "acct_stellar")).toEqual([]);
  });

  it("returns the unfiltered feed when no account id is selected", () => {
    const items = [tx({ id: 1, financial_account_id: "acct_stellar" })];
    expect(recentActivityForFinancialAccount(items, null)).toEqual(items);
    expect(recentActivityForFinancialAccount(items, "")).toEqual(items);
  });
});
