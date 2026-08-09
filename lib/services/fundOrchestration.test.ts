import { describe, expect, it } from "vitest";
import {
  africanFundDisabledReason,
  buildLedgerConvertQuotePayload,
  planAfricanFundOrchestration,
  resolveOnRampWalletAddress,
} from "./fundOrchestration";

describe("resolveOnRampWalletAddress", () => {
  it("prefers the USDC deposit wallet", () => {
    expect(
      resolveOnRampWalletAddress({
        usdcWalletAddress: "0xusdc",
        treasuryWalletAddress: "0xtreasury",
      }),
    ).toEqual({ address: "0xusdc", source: "usdc_deposit" });
  });

  it("falls back to treasury", () => {
    expect(
      resolveOnRampWalletAddress({
        usdcWalletAddress: null,
        treasuryWalletAddress: "0xtreasury",
      }),
    ).toEqual({ address: "0xtreasury", source: "treasury" });
  });
});

describe("planAfricanFundOrchestration", () => {
  it("allows OnRamp + convert when USDC wallet and convert ids exist", () => {
    const plan = planAfricanFundOrchestration({
      fiatCurrency: "EUR",
      fiatAccountId: "42",
      entityId: "3",
      usdcAccountId: "55",
      usdcWalletAddress: "0xusdc",
      treasuryWalletAddress: "0xtreasury",
      convertNetworkId: "rail-uuid",
    });
    expect(plan.canRunAfricanOnRamp).toBe(true);
    expect(plan.canAttemptAutoConvert).toBe(true);
    expect(plan.onRampWalletSource).toBe("usdc_deposit");
  });

  it("blocks auto-convert when OnRamp would hit treasury only", () => {
    const plan = planAfricanFundOrchestration({
      fiatCurrency: "USD",
      fiatAccountId: "42",
      entityId: "3",
      usdcAccountId: "55",
      usdcWalletAddress: null,
      treasuryWalletAddress: "0xtreasury",
      convertNetworkId: "rail-uuid",
    });
    expect(plan.canRunAfricanOnRamp).toBe(true);
    expect(plan.canAttemptAutoConvert).toBe(false);
    expect(plan.blockers.some((b) => /treasury/i.test(b))).toBe(true);
  });

  it("disables African path without any wallet", () => {
    const plan = planAfricanFundOrchestration({
      fiatCurrency: "EUR",
      fiatAccountId: "42",
      entityId: "3",
      usdcAccountId: "55",
      usdcWalletAddress: null,
      treasuryWalletAddress: null,
      convertNetworkId: "rail-uuid",
    });
    expect(plan.canRunAfricanOnRamp).toBe(false);
    expect(africanFundDisabledReason(plan)).toMatch(/wallet/i);
  });

  it("rejects non EUR/USD/GBP deposit targets", () => {
    const plan = planAfricanFundOrchestration({
      fiatCurrency: "KES",
      fiatAccountId: "42",
      entityId: "3",
      usdcAccountId: "55",
      usdcWalletAddress: "0xusdc",
      treasuryWalletAddress: null,
      convertNetworkId: "rail-uuid",
    });
    expect(plan.canRunAfricanOnRamp).toBe(false);
    expect(plan.blockers.some((b) => /KES/.test(b))).toBe(true);
  });
});

describe("buildLedgerConvertQuotePayload", () => {
  it("builds partner-shaped OffRamp convert body", () => {
    expect(
      buildLedgerConvertQuotePayload({
        fiatCurrency: "eur",
        cryptoAmount: "10.5",
        networkId: "rail-1",
        entityId: 3,
        usdcAccountId: 55,
        fiatAccountId: 42,
      }),
    ).toEqual({
      order_type: "OffRamp",
      currency: "EUR",
      crypto_amount: 10.5,
      asset: { currency: "USDC" },
      payment_method: {
        type: "bank",
        network_id: "rail-1",
        entity_id: 3,
        account_id: 55,
        destination_account_id: 42,
      },
    });
  });

  it("rejects non-positive amounts", () => {
    expect(() =>
      buildLedgerConvertQuotePayload({
        fiatCurrency: "USD",
        cryptoAmount: "0",
        networkId: "rail-1",
        entityId: 1,
        usdcAccountId: 2,
        fiatAccountId: 3,
      }),
    ).toThrow(/positive/i);
  });
});
