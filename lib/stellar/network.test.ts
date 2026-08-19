import { describe, expect, it } from "vitest";
import {
  STELLAR_USDC_ISSUER_PUBLIC,
  STELLAR_USDC_ISSUER_TESTNET,
  isStellarNetwork,
  isStellarUsdcRail,
  resolveStellarNetwork,
  truncateStellarAddress,
} from "./network";

describe("stellar network helpers", () => {
  it("detects Stellar rails including testnet spellings", () => {
    expect(isStellarNetwork("Stellar")).toBe(true);
    expect(isStellarNetwork("stellar_testnet")).toBe(true);
    expect(isStellarNetwork("Base")).toBe(false);
  });

  it("only enables wallet send for USDC on Stellar", () => {
    expect(isStellarUsdcRail({ network: "Stellar", currency: "USDC" })).toBe(true);
    expect(isStellarUsdcRail({ network: "stellar_testnet", currency: "usdc" })).toBe(true);
    expect(isStellarUsdcRail({ network: "Stellar", currency: "USDT" })).toBe(false);
    expect(isStellarUsdcRail({ network: "Base", currency: "USDC" })).toBe(false);
  });

  it("pins Circle issuers and Horizon by network", () => {
    expect(resolveStellarNetwork("Stellar")).toMatchObject({
      isTestnet: false,
      usdcIssuer: STELLAR_USDC_ISSUER_PUBLIC,
      horizonUrl: "https://horizon.stellar.org",
    });
    expect(resolveStellarNetwork("stellar_testnet")).toMatchObject({
      isTestnet: true,
      usdcIssuer: STELLAR_USDC_ISSUER_TESTNET,
      horizonUrl: "https://horizon-testnet.stellar.org",
    });
  });

  it("truncates G-addresses for display", () => {
    expect(truncateStellarAddress("GBXCJB6GSHU7DBYBQ7OQQRD4GWDNYRSNU5KSAVQBJ4LXAZIA23CXOKEE")).toBe(
      "GBXCJB…CXOKEE",
    );
  });
});
