import { describe, expect, it } from "vitest";
import {
  accountCreditApiPathId,
  isInboundStellarDeposit,
  recentActivityForFinancialAccount,
  toAccountCreditId,
} from "./accountCredits";
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

describe("toAccountCreditId / accountCreditApiPathId", () => {
  it("normalizes numeric Mboka credit ids to acr_<n>", () => {
    expect(toAccountCreditId(7)).toBe("acr_7");
    expect(toAccountCreditId("7")).toBe("acr_7");
    expect(toAccountCreditId("acr_7")).toBe("acr_7");
    expect(toAccountCreditId("acr_01hqxyz")).toBe("acr_01hqxyz");
  });

  it("strips acr_ only for numeric path segments on GET /v1/account-credits/{id}", () => {
    expect(accountCreditApiPathId("acr_7")).toBe("7");
    expect(accountCreditApiPathId(7)).toBe("7");
    expect(accountCreditApiPathId("7")).toBe("7");
    expect(accountCreditApiPathId("acr_01hqxyz")).toBe("acr_01hqxyz");
  });
});

describe("isInboundStellarDeposit (Mboka wire)", () => {
  it("treats provider=stellar projected credits as Stellar inbound", () => {
    expect(
      isInboundStellarDeposit(
        tx({
          id: "acr_7",
          provider: "stellar",
          tx_hash: "abc",
          crypto_network: null,
          source: null,
        }),
      ),
    ).toBe(true);
  });

  it("treats acr_ + tx_hash as Stellar inbound when network is absent", () => {
    expect(
      isInboundStellarDeposit(
        tx({
          id: "acr_7",
          tx_hash: "abc",
          provider: null,
          crypto_network: null,
          source: null,
        }),
      ),
    ).toBe(true);
  });

  it("does not treat acr_ rows on a competing non-Stellar network as Stellar", () => {
    expect(
      isInboundStellarDeposit(
        tx({
          id: "acr_7",
          tx_hash: "abc",
          crypto_network: "Base",
          provider: null,
          source: null,
        }),
      ),
    ).toBe(false);
  });
});

describe("recentActivityForFinancialAccount", () => {
  it("keeps the unfiltered feed when no rows carry account or wallet scope", () => {
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
    expect(recentActivityForFinancialAccount(items, "acct_stellar")).toEqual([items[1]]);
  });

  it("scopes by wallet_address when account ids are absent (current Mboka projection)", () => {
    const g = "GBXCJB6GSHU7DBYBQ7OQQRD4GWDNYRSNU5KSAVQBJ4LXAZIA23CXOKEE";
    const items = [
      tx({ id: "acr_other", wallet_address: "GOTHER", tx_hash: "h1", provider: "stellar" }),
      tx({ id: "acr_mine", wallet_address: g, tx_hash: "h2", provider: "stellar" }),
      tx({ id: 9, wallet_address: null }),
    ];
    expect(
      recentActivityForFinancialAccount(items, {
        financialAccountId: "acct_stellar",
        walletAddress: g,
      }),
    ).toEqual([items[1]]);
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
