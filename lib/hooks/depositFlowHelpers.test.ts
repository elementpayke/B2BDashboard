import { describe, expect, it } from "vitest";
import {
  buildDepositDestinationSummary,
  buildDepositStepDots,
} from "./depositFlowHelpers";

describe("buildDepositDestinationSummary", () => {
  it("describes a stablecoin top-up", () => {
    expect(
      buildDepositDestinationSummary({
        depositGroup: "crypto",
        depositAsset: "usdc",
        depositNetworkLabel: "Base",
        countryName: "Kenya",
        providerName: "M-Pesa",
      }),
    ).toBe("USDC · Base");
  });

  it("describes a fiat corridor top-up", () => {
    expect(
      buildDepositDestinationSummary({
        depositGroup: "country",
        depositAsset: "usdc",
        depositNetworkLabel: "Base",
        countryName: "Kenya",
        providerName: "M-Pesa",
      }),
    ).toBe("Kenya · M-Pesa");
  });
});

describe("buildDepositStepDots", () => {
  it("marks completed steps", () => {
    expect(buildDepositStepDots(2, 3)).toEqual([{ on: true }, { on: true }, { on: false }]);
  });
});
