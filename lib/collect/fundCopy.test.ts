import { describe, expect, it } from "vitest";
import { fundStablecoinRailSummary, isCollectCctpRail, isEvmEurcRail } from "./fundCopy";

describe("fundStablecoinRailSummary", () => {
  it("uses generic USDC processing copy for all USDC rails", () => {
    expect(
      fundStablecoinRailSummary({
        targetName: "USDC · Stellar",
        currency: "USDC",
        networkLabel: "Base",
        railId: "collect-cctp:42:base:0xabc",
      }),
    ).toBe("Deposit USDC on Base. Credits your USDC balance after processing.");
    expect(
      fundStablecoinRailSummary({
        targetName: "USDC · Base",
        currency: "USDC",
        networkLabel: "Base",
        railId: "acct-base",
      }),
    ).toBe("Deposit USDC on Base. Credits your USDC balance after processing.");
  });

  it("describes Stellar EURC Aquarius conversion", () => {
    expect(
      fundStablecoinRailSummary({
        targetName: "USDC home",
        currency: "EURC",
        networkLabel: "Stellar",
      }),
    ).toContain("Aquarius");
  });
});

describe("isCollectCctpRail", () => {
  it("detects collect-cctp ids only", () => {
    expect(isCollectCctpRail({ railId: "collect-cctp:1:base:0x" })).toBe(true);
    expect(isCollectCctpRail({ railId: "acct-1", chainDisclaimer: "after processing" })).toBe(false);
  });
});

describe("isEvmEurcRail", () => {
  it("flags EURC on Base as unsupported Collect rail", () => {
    expect(isEvmEurcRail("EURC", "Base")).toBe(true);
    expect(isEvmEurcRail("EURC", "Stellar")).toBe(false);
    expect(isEvmEurcRail("USDC", "Base")).toBe(false);
  });
});
