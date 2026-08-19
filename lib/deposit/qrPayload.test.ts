import { describe, expect, it } from "vitest";
import { STELLAR_TESTNET_PASSPHRASE, STELLAR_USDC_ISSUER_PUBLIC, STELLAR_USDC_ISSUER_TESTNET } from "@/lib/stellar/network";
import { buildDepositQrValue } from "./qrPayload";

const STELLAR_ADDR = "GBXCJB6GSHU7DBYBQ7OQQRD4GWDNYRSNU5KSAVQBJ4LXAZIA23CXOKEE";

describe("buildDepositQrValue", () => {
  it("encodes a SEP-0007 pay URI for Stellar USDC, including amount when set", () => {
    const value = buildDepositQrValue({
      address: STELLAR_ADDR,
      currency: "USDC",
      network: "Stellar",
      amount: "10",
    });
    expect(value.startsWith("web+stellar:pay?")).toBe(true);
    const query = new URLSearchParams(value.slice("web+stellar:pay?".length));
    expect(query.get("destination")).toBe(STELLAR_ADDR);
    expect(query.get("asset_code")).toBe("USDC");
    expect(query.get("asset_issuer")).toBe(STELLAR_USDC_ISSUER_PUBLIC);
    expect(query.get("amount")).toBe("10");
    expect(query.get("network_passphrase")).toBeNull();
  });

  it("includes the testnet network passphrase on stellar_testnet", () => {
    const value = buildDepositQrValue({
      address: STELLAR_ADDR,
      currency: "USDC",
      network: "stellar_testnet",
    });
    const query = new URLSearchParams(value.slice("web+stellar:pay?".length));
    expect(query.get("asset_issuer")).toBe(STELLAR_USDC_ISSUER_TESTNET);
    expect(query.get("network_passphrase")).toBe(STELLAR_TESTNET_PASSPHRASE);
  });

  it("encodes the raw address on non-Stellar rails", () => {
    expect(
      buildDepositQrValue({
        address: "0xabc",
        currency: "USDC",
        network: "Base",
      }),
    ).toBe("0xabc");
  });
});
