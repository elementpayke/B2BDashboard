import { describe, expect, it } from "vitest";
import {
  STELLAR_USDC_ISSUER_PUBLIC,
  STELLAR_USDC_ISSUER_TESTNET,
  isStellarNetwork,
  isStellarUsdcRail,
  resolveStellarNetwork,
  stellarExplorerTxUrl,
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

  it("pins Circle testnet USDC unless the rail is explicitly public", () => {
    expect(resolveStellarNetwork("Stellar")).toMatchObject({
      isTestnet: true,
      usdcIssuer: STELLAR_USDC_ISSUER_TESTNET,
      horizonUrl: "https://horizon-testnet.stellar.org",
    });
    expect(resolveStellarNetwork("stellar_testnet")).toMatchObject({
      isTestnet: true,
      usdcIssuer: STELLAR_USDC_ISSUER_TESTNET,
      horizonUrl: "https://horizon-testnet.stellar.org",
    });
    expect(resolveStellarNetwork("stellar_public")).toMatchObject({
      isTestnet: false,
      usdcIssuer: STELLAR_USDC_ISSUER_PUBLIC,
      horizonUrl: "https://horizon.stellar.org",
    });
  });

  it("truncates G-addresses for display", () => {
    expect(truncateStellarAddress("GBXCJB6GSHU7DBYBQ7OQQRD4GWDNYRSNU5KSAVQBJ4LXAZIA23CXOKEE")).toBe(
      "GBXCJB…CXOKEE",
    );
  });
});

describe("stellarExplorerTxUrl", () => {
  const hash = "a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456";

  it("builds a public explorer URL for public / mainnet rails", () => {
    expect(stellarExplorerTxUrl({ txHash: hash, network: "stellar_public" })).toBe(
      `https://stellar.expert/explorer/public/tx/${hash}`,
    );
    expect(stellarExplorerTxUrl({ txHash: hash, network: "stellar_mainnet" })).toBe(
      `https://stellar.expert/explorer/public/tx/${hash}`,
    );
    expect(stellarExplorerTxUrl({ txHash: hash, isTestnet: false })).toBe(
      `https://stellar.expert/explorer/public/tx/${hash}`,
    );
  });

  it("builds a testnet explorer URL for testnet / generic Stellar rails", () => {
    expect(stellarExplorerTxUrl({ txHash: hash, network: "stellar_testnet" })).toBe(
      `https://stellar.expert/explorer/testnet/tx/${hash}`,
    );
    expect(stellarExplorerTxUrl({ txHash: hash, network: "Stellar" })).toBe(
      `https://stellar.expert/explorer/testnet/tx/${hash}`,
    );
    expect(stellarExplorerTxUrl({ txHash: hash, isTestnet: true })).toBe(
      `https://stellar.expert/explorer/testnet/tx/${hash}`,
    );
  });

  it("returns null when the hash is missing — never invents a link", () => {
    expect(stellarExplorerTxUrl({ txHash: "", network: "Stellar" })).toBeNull();
    expect(stellarExplorerTxUrl({ txHash: "   ", isTestnet: false })).toBeNull();
    expect(stellarExplorerTxUrl({ txHash: null, network: "stellar_public" })).toBeNull();
    expect(stellarExplorerTxUrl({ txHash: undefined, isTestnet: true })).toBeNull();
  });

  it("URL-encodes the hash path segment", () => {
    expect(stellarExplorerTxUrl({ txHash: "abc/def", isTestnet: true })).toBe(
      "https://stellar.expert/explorer/testnet/tx/abc%2Fdef",
    );
  });
});
