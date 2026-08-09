import { describe, expect, it } from "vitest";
import {
  buildFundStablecoinRails,
  formatNetworkLabel,
  isFundableStablecoinAccount,
  isListedStablecoinAccount,
  isSendableStablecoinAccount,
  normalizeFinancialAccount,
  type FinancialAccount,
} from "./entities";

function acct(partial: Partial<FinancialAccount> = {}): FinancialAccount {
  return {
    id: "id-1",
    entityId: "e1",
    assetType: "stablecoin",
    currency: "USDC",
    network: "Base",
    status: "active",
    walletAddress: "0xabc",
    ...partial,
  };
}

describe("formatNetworkLabel", () => {
  it("canonicalizes known rails and keeps API labels otherwise", () => {
    expect(formatNetworkLabel("base")).toBe("Base");
    expect(formatNetworkLabel("POLYGON")).toBe("Polygon");
    expect(formatNetworkLabel("Ethereum")).toBe("Ethereum");
    expect(formatNetworkLabel("")).toBe("—");
  });
});

describe("stablecoin account predicates", () => {
  it("lists any stablecoin the API returns", () => {
    expect(isListedStablecoinAccount(acct({ currency: "USDT", network: "Tron" }))).toBe(true);
    expect(isListedStablecoinAccount(acct({ assetType: "fiat", currency: "EUR" }))).toBe(false);
  });

  it("funds only ready rails with a wallet", () => {
    expect(isFundableStablecoinAccount(acct({}))).toBe(true);
    expect(isFundableStablecoinAccount(acct({ status: "pending" }))).toBe(false);
    expect(isFundableStablecoinAccount(acct({ walletAddress: null }))).toBe(false);
  });

  it("keeps Phase 4 sendable limited to USDC Base/Polygon", () => {
    expect(isSendableStablecoinAccount(acct({ network: "Base" }))).toBe(true);
    expect(isSendableStablecoinAccount(acct({ currency: "USDT", network: "Base" }))).toBe(false);
    expect(isSendableStablecoinAccount(acct({ network: "Ethereum" }))).toBe(false);
  });
});

describe("normalizeFinancialAccount", () => {
  it("maps wallet, disclaimer, and checkout from partner spellings", () => {
    const normalized = normalizeFinancialAccount(
      {
        id: "9",
        asset_type: "stablecoin",
        currency: "usdt",
        network: "Polygon",
        status: "active",
        wallet_address: "0xdead",
        chain_disclaimer: "Send only USDT on Polygon.",
        checkout_url: "https://checkout.example/pay",
      },
      "ent-1",
    );
    expect(normalized).toMatchObject({
      id: "9",
      currency: "USDT",
      walletAddress: "0xdead",
      chainDisclaimer: "Send only USDT on Polygon.",
      checkoutUrl: "https://checkout.example/pay",
    });
  });
});

describe("buildFundStablecoinRails", () => {
  it("builds one UX rail per fundable account from the API", () => {
    const rails = buildFundStablecoinRails([
      acct({ id: "1", currency: "USDC", network: "Base" }),
      acct({ id: "2", currency: "USDT", network: "Polygon", walletAddress: "0xusdt" }),
      acct({ id: "3", status: "pending", walletAddress: "0xpending" }),
    ]);
    expect(rails).toHaveLength(2);
    expect(rails[0]).toMatchObject({
      currency: "USDC",
      networkLabel: "Base",
      walletAddress: "0xabc",
    });
    expect(rails[1].currency).toBe("USDT");
    expect(rails[1].chainDisclaimer).toMatch(/USDT/);
  });
});
