import { describe, expect, it } from "vitest";
import {
  buildSendPreviewPayload,
  validateEvmAddress,
  validateSendAmount,
} from "./accountSends";
import {
  accountForNetwork,
  extractAccountRows,
  isSendableStablecoinAccount,
  normalizeFinancialAccount,
  toPartnerNetwork,
} from "./entities";

describe("account send validation", () => {
  it("accepts a checksummed EVM address", () => {
    expect(validateEvmAddress("0x1111111111111111111111111111111111111111")).toBe(
      "0x1111111111111111111111111111111111111111",
    );
  });

  it("rejects ENS / short addresses", () => {
    expect(() => validateEvmAddress("vitalik.eth")).toThrow(/0x EVM/);
    expect(() => validateEvmAddress("0xabc")).toThrow(/0x EVM/);
  });

  it("enforces the 1 USDC minimum", () => {
    expect(validateSendAmount("1")).toBe("1");
    expect(validateSendAmount("1.00")).toBe("1.00");
    expect(() => validateSendAmount("0.99")).toThrow(/Minimum/);
  });

  it("builds a partner-shaped preview body", () => {
    expect(
      buildSendPreviewPayload({
        toAddress: "0x1111111111111111111111111111111111111111",
        amount: "2.5",
        networkKey: "base",
      }),
    ).toEqual({
      to_address: "0x1111111111111111111111111111111111111111",
      amount: "2.5",
      network: "Base",
    });
    expect(toPartnerNetwork("POLYGON")).toBe("Polygon");
    expect(toPartnerNetwork("ethereum")).toBeNull();
  });
});

describe("sendable account discovery helpers", () => {
  it("extracts accounts from several partner list shapes", () => {
    expect(extractAccountRows({ accounts: [{ id: "a1" }] })).toHaveLength(1);
    expect(extractAccountRows({ items: [{ id: "a2" }] })).toHaveLength(1);
    expect(extractAccountRows([{ id: "a3" }])).toHaveLength(1);
  });

  it("keeps only ready USDC Base/Polygon accounts", () => {
    const ready = normalizeFinancialAccount(
      {
        id: "acct_base",
        asset_type: "stablecoin",
        currency: "usdc",
        network: "Base",
        status: "ready",
      },
      "ent_1",
    )!;
    const eth = normalizeFinancialAccount(
      {
        id: "acct_eth",
        asset_type: "stablecoin",
        currency: "USDC",
        network: "Ethereum",
        status: "ready",
      },
      "ent_1",
    )!;
    const pending = normalizeFinancialAccount(
      {
        id: "acct_poly",
        asset_type: "stablecoin",
        currency: "USDC",
        network: "Polygon",
        status: "pending",
      },
      "ent_1",
    )!;
    expect(isSendableStablecoinAccount(ready)).toBe(true);
    expect(isSendableStablecoinAccount(eth)).toBe(false);
    expect(isSendableStablecoinAccount(pending)).toBe(false);
    expect(accountForNetwork([ready], "base")?.id).toBe("acct_base");
  });
});
