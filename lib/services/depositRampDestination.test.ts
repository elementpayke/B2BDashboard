import { describe, expect, it } from "vitest";
import type { FinancialAccount } from "./entities";
import { buildDepositQuotePayload } from "./orders";
import {
  describeMissingOnRampDestination,
  resolveAfricanFundOpenIntent,
  resolveOnRampDestination,
  resolveStablecoinPickerDestination,
  stablecoinNetworksForAsset,
} from "./depositRampDestination";

const STELLAR_ADDR = "GBXCJB6GSHU7DBYBQ7OQQRD4GWDNYRSNU5KSAVQBJ4LXAZIA23CXOKEE";
const POLY_USDT = "0x1111111111111111111111111111111111111111";
const BASE_USDC = "0x2222222222222222222222222222222222222222";
const TREASURY_EVM = "0x3333333333333333333333333333333333333333";

function acct(partial: Partial<FinancialAccount> & Pick<FinancialAccount, "id">): FinancialAccount {
  return {
    entityId: "e1",
    assetType: "stablecoin",
    currency: "USDC",
    network: "Base",
    status: "active",
    walletAddress: BASE_USDC,
    ...partial,
  };
}

const polygonUsdt = acct({
  id: "poly-usdt",
  currency: "USDT",
  network: "Polygon",
  walletAddress: POLY_USDT,
});
const stellarUsdc = acct({
  id: "xlm-usdc",
  currency: "USDC",
  network: "Stellar",
  walletAddress: STELLAR_ADDR,
});
const baseUsdc = acct({ id: "base-usdc" });

describe("resolveOnRampDestination", () => {
  it("pins the selected Stellar USDC wallet even when Polygon USDT exists and depositNetwork leftover is polygon", () => {
    const dest = resolveOnRampDestination({
      accounts: [polygonUsdt, stellarUsdc, baseUsdc],
      selectedAccountId: "xlm-usdc",
      depositNetworkKey: "polygon",
      depositAsset: "usdt",
      fundAfricanTargetCurrency: "USDC",
      summaryWallet: TREASURY_EVM,
    });
    expect(dest).toEqual({
      accountId: "xlm-usdc",
      walletAddress: STELLAR_ADDR,
      asset: { currency: "USDC", network: "Stellar" },
    });
  });

  it("does not omit asset when the treasury summary address differs from the Stellar G-address", () => {
    const dest = resolveOnRampDestination({
      accounts: [polygonUsdt, stellarUsdc],
      selectedAccountId: stellarUsdc.id,
      depositNetworkKey: "base",
      summaryWallet: TREASURY_EVM,
    });
    expect(dest?.asset).toEqual({ currency: "USDC", network: "Stellar" });
    expect(dest?.walletAddress).toBe(STELLAR_ADDR);
  });

  it("never picks Polygon USDT just because it is first on the leftover chain", () => {
    const dest = resolveOnRampDestination({
      accounts: [polygonUsdt],
      depositNetworkKey: "polygon",
      depositAsset: "usdc",
    });
    expect(dest).toBeNull();
  });

  it("falls back to another USDC rail instead of Polygon USDT when the leftover chain has no USDC", () => {
    const dest = resolveOnRampDestination({
      accounts: [polygonUsdt, baseUsdc],
      depositNetworkKey: "polygon",
      depositAsset: "usdc",
    });
    expect(dest?.asset).toEqual({ currency: "USDC", network: "Base" });
  });

  it("uses an explicit USDT + Polygon selection for the generic crypto top-up", () => {
    const dest = resolveOnRampDestination({
      accounts: [polygonUsdt, baseUsdc],
      depositNetworkKey: "polygon",
      depositAsset: "usdt",
    });
    expect(dest).toEqual({
      accountId: "poly-usdt",
      walletAddress: POLY_USDT,
      asset: { currency: "USDT", network: "Polygon" },
    });
  });

  it("prefers USDC on the selected chain over USDT when the top-up asset is USDC", () => {
    const polygonUsdc = acct({
      id: "poly-usdc",
      currency: "USDC",
      network: "Polygon",
      walletAddress: "0x4444444444444444444444444444444444444444",
    });
    const dest = resolveOnRampDestination({
      accounts: [polygonUsdt, polygonUsdc],
      depositNetworkKey: "polygon",
      depositAsset: "usdc",
    });
    expect(dest?.accountId).toBe("poly-usdc");
    expect(dest?.asset).toEqual({ currency: "USDC", network: "Polygon" });
  });

  it("lands African fiat fund on a ready USDC rail, not Polygon USDT", () => {
    const dest = resolveOnRampDestination({
      accounts: [polygonUsdt, stellarUsdc],
      depositNetworkKey: "base",
      depositAsset: "usdc",
      fundAfricanTargetCurrency: "EUR",
      summaryWallet: TREASURY_EVM,
    });
    expect(dest?.asset).toEqual({ currency: "USDC", network: "Stellar" });
    expect(dest?.walletAddress).toBe(STELLAR_ADDR);
  });

  it("ignores a pending selected account rather than falling through to Polygon USDT", () => {
    const dest = resolveOnRampDestination({
      accounts: [
        acct({ ...stellarUsdc, status: "pending" }),
        polygonUsdt,
      ],
      selectedAccountId: "xlm-usdc",
      depositNetworkKey: "polygon",
      depositAsset: "usdt",
    });
    expect(dest).toBeNull();
  });

  it("does not use a summary EVM treasury as the destination without a matching account+asset", () => {
    const dest = resolveOnRampDestination({
      accounts: [stellarUsdc],
      depositNetworkKey: "base",
      summaryWallet: TREASURY_EVM,
    });
    expect(dest?.walletAddress).toBe(STELLAR_ADDR);
    expect(dest?.asset.network).toBe("Stellar");
  });

  it("returns null when nothing fundable exists", () => {
    expect(
      resolveOnRampDestination({
        accounts: [acct({ id: "p", status: "pending", walletAddress: "0xabc" })],
        depositNetworkKey: "base",
        summaryWallet: TREASURY_EVM,
      }),
    ).toBeNull();
  });

  it("does not fall back to Base USDC when Stellar is selected but not ready", () => {
    expect(
      resolveOnRampDestination({
        accounts: [baseUsdc, polygonUsdt],
        depositNetworkKey: "stellar",
        depositAsset: "usdc",
        summaryWallet: TREASURY_EVM,
      }),
    ).toBeNull();
  });

  it("puts Stellar USDC on the OnRamp quote, not Polygon USDT", () => {
    const dest = resolveOnRampDestination({
      accounts: [polygonUsdt, stellarUsdc],
      selectedAccountId: "xlm-usdc",
      depositNetworkKey: "polygon",
      summaryWallet: TREASURY_EVM,
    });
    expect(dest).not.toBeNull();
    const payload = buildDepositQuotePayload({
      currency: "kes",
      countryIso: "ke",
      railType: "mobile",
      payerAccountNumber: "0712345678",
      payerName: "Acme",
      amount: "800",
      walletAddress: dest!.walletAddress,
      asset: dest!.asset,
      dialCode: "254",
    });
    expect(payload.wallet_address).toBe(STELLAR_ADDR);
    expect(payload.asset).toEqual({ currency: "USDC", network: "Stellar" });
    expect(payload.asset).not.toEqual({ currency: "USDT", network: "Polygon" });
  });
});

describe("describeMissingOnRampDestination", () => {
  it("calls out a selected wallet that is not ready to receive", () => {
    expect(
      describeMissingOnRampDestination({ selectedAccountId: "xlm-usdc", summaryFailed: false }),
    ).toMatch(/selected/i);
  });
});

describe("resolveAfricanFundOpenIntent", () => {
  it("targets the selected Stellar account instead of hard-coding EUR / Base", () => {
    expect(
      resolveAfricanFundOpenIntent({
        selectedKind: "stablecoin",
        selectedStablecoin: {
          id: "xlm-usdc",
          currency: "USDC",
          network: "Stellar",
        },
      }),
    ).toEqual({
      fundAfricanTargetCurrency: "USDC",
      fundTargetAccountId: "xlm-usdc",
      depositNetwork: "stellar",
      depositAsset: "usdc",
    });
  });

  it("keeps fiat African fund on the fiat currency with no pinned stablecoin account", () => {
    expect(
      resolveAfricanFundOpenIntent({
        selectedKind: "fiat",
        selectedFiatCurrency: "eur",
      }),
    ).toEqual({
      fundAfricanTargetCurrency: "EUR",
      fundTargetAccountId: null,
      depositNetwork: "base",
      depositAsset: "usdc",
    });
  });

  it("maps stellar_testnet to the Stellar UI key", () => {
    expect(
      resolveAfricanFundOpenIntent({
        selectedKind: "stablecoin",
        selectedStablecoin: { id: "1", currency: "USDC", network: "stellar_testnet" },
      }).depositNetwork,
    ).toBe("stellar");
  });
});

describe("stablecoinNetworksForAsset", () => {
  const networks = [
    { key: "base", label: "Base" },
    { key: "stellar", label: "Stellar" },
    { key: "polygon", label: "Polygon" },
  ];

  it("includes Stellar for USDC", () => {
    expect(stablecoinNetworksForAsset(networks, "usdc").map((n) => n.key)).toEqual([
      "base",
      "stellar",
      "polygon",
    ]);
  });

  it("hides Stellar for USDT", () => {
    expect(stablecoinNetworksForAsset(networks, "usdt").map((n) => n.key)).toEqual([
      "base",
      "polygon",
    ]);
  });
});

describe("resolveStablecoinPickerDestination", () => {
  it("returns the ready Stellar G-address, not the EVM treasury", () => {
    const dest = resolveStablecoinPickerDestination({
      accounts: [baseUsdc, stellarUsdc],
      asset: "usdc",
      networkKey: "stellar",
      treasuryWallet: TREASURY_EVM,
    });
    expect(dest.address).toBe(STELLAR_ADDR);
    expect(dest.address?.startsWith("G")).toBe(true);
  });

  it("fails closed when Stellar USDC is not ready", () => {
    const dest = resolveStablecoinPickerDestination({
      accounts: [baseUsdc],
      asset: "usdc",
      networkKey: "stellar",
      treasuryWallet: TREASURY_EVM,
    });
    expect(dest.address).toBeNull();
    expect(dest.emptyMessage).toMatch(/No ready Stellar USDC wallet/i);
  });

  it("does not invent a Stellar address from a pending account", () => {
    const dest = resolveStablecoinPickerDestination({
      accounts: [acct({ ...stellarUsdc, status: "pending" })],
      asset: "usdc",
      networkKey: "stellar",
    });
    expect(dest.address).toBeNull();
  });

  it("uses the matching Base account before the treasury", () => {
    const dest = resolveStablecoinPickerDestination({
      accounts: [baseUsdc],
      asset: "usdc",
      networkKey: "base",
      treasuryWallet: TREASURY_EVM,
    });
    expect(dest.address).toBe(BASE_USDC);
  });

  it("falls back to the EVM treasury on Base when no matching account exists", () => {
    const dest = resolveStablecoinPickerDestination({
      accounts: [stellarUsdc],
      asset: "usdc",
      networkKey: "base",
      treasuryWallet: TREASURY_EVM,
    });
    expect(dest.address).toBe(TREASURY_EVM);
  });
});
