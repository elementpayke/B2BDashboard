import { describe, expect, it } from "vitest";
import { fundStablecoinRailSummary, isCollectCctpRail, isEvmEurcRail } from "./fundCopy";

describe("fundStablecoinRailSummary", () => {
  it("uses CCTP copy only for Collect-provenance rails", () => {
    expect(
      fundStablecoinRailSummary({
        targetName: "USDC · Stellar",
        currency: "USDC",
        networkLabel: "Base",
        railId: "collect-cctp:42:base:0xabc",
        chainDisclaimer: "Credits Stellar USDC after CCTP processing.",
      }),
    ).toBe(
      "Deposit USDC on Base. Credits your Stellar USDC after CCTP processing.",
    );
  });

  it("keeps generic processing copy for account-derived EVM USDC rails", () => {
    expect(
      fundStablecoinRailSummary({
        targetName: "USDC · Base",
        currency: "USDC",
        networkLabel: "Base",
        railId: "acct-base",
        chainDisclaimer: "Send only USDC on Base.",
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
  it("detects collect-cctp ids and CCTP disclaimers", () => {
    expect(isCollectCctpRail({ railId: "collect-cctp:1:base:0x" })).toBe(true);
    expect(isCollectCctpRail({ chainDisclaimer: "after CCTP processing" })).toBe(true);
    expect(isCollectCctpRail({ railId: "acct-1", chainDisclaimer: "Send only USDC" })).toBe(false);
  });
});

describe("isEvmEurcRail", () => {
  it("flags EURC on Base as unsupported Collect rail", () => {
    expect(isEvmEurcRail("EURC", "Base")).toBe(true);
    expect(isEvmEurcRail("EURC", "Stellar")).toBe(false);
    expect(isEvmEurcRail("USDC", "Base")).toBe(false);
  });
});
