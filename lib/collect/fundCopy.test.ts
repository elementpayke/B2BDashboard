import { describe, expect, it } from "vitest";
import { fundStablecoinRailSummary, isEvmEurcRail } from "./fundCopy";

describe("fundStablecoinRailSummary", () => {
  it("describes EVM USDC CCTP processing honestly", () => {
    expect(
      fundStablecoinRailSummary({
        targetName: "USDC · Stellar",
        currency: "USDC",
        networkLabel: "Base",
      }),
    ).toBe(
      "Deposit USDC on Base. Credits your Stellar USDC after CCTP processing.",
    );  });

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

describe("isEvmEurcRail", () => {
  it("flags EURC on Base as unsupported Collect rail", () => {
    expect(isEvmEurcRail("EURC", "Base")).toBe(true);
    expect(isEvmEurcRail("EURC", "Stellar")).toBe(false);
    expect(isEvmEurcRail("USDC", "Base")).toBe(false);
  });
});
