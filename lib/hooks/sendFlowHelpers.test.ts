import { describe, it, expect } from "vitest";
import { buildSendDestinationSummary, buildSendStepDots } from "./sendFlowHelpers";

describe("buildSendDestinationSummary", () => {
  it("formats a country-rail destination", () => {
    expect(
      buildSendDestinationSummary({
        sendGroup: "country",
        sendAsset: "usdc",
        sendChainLabel: "Base",
        countryName: "Kenya",
        providerName: "M-Pesa",
      }),
    ).toBe("Kenya · M-Pesa");
  });

  it("formats a stablecoin destination", () => {
    expect(
      buildSendDestinationSummary({
        sendGroup: "crypto",
        sendAsset: "usdc",
        sendChainLabel: "Base",
        countryName: "Kenya",
        providerName: "M-Pesa",
      }),
    ).toBe("USDC · Base");
  });
});

describe("buildSendStepDots", () => {
  it("marks completed steps as on", () => {
    expect(buildSendStepDots(2)).toEqual([{ on: true }, { on: true }, { on: false }]);
  });
});
