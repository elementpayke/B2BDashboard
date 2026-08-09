import { describe, it, expect } from "vitest";
import {
  buildSendDestinationSummary,
  buildSendStepDots,
  railIndexForMethod,
  sendRailHasChoice,
} from "./sendFlowHelpers";

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

describe("railIndexForMethod", () => {
  // Kenya, as defined in components/mockData.ts: mobile first, then bank.
  const kenya = [{ type: "mobile" }, { type: "bank" }];
  // South Africa has a bank rail only.
  const southAfrica = [{ type: "bank" }];

  it("selects the mobile rail when the user chose Mobile money", () => {
    expect(railIndexForMethod(kenya, "mobile")).toBe(0);
  });

  it("selects the bank rail when the user chose Bank transfer", () => {
    expect(railIndexForMethod(kenya, "bank")).toBe(1);
  });

  it("falls back to the first rail when the country has no rail of that type", () => {
    // Choosing Mobile money then picking South Africa must not crash or
    // select index -1 — it degrades to the country's only rail.
    expect(railIndexForMethod(southAfrica, "mobile")).toBe(0);
  });

  it("does not preselect for crypto or an unchosen method", () => {
    expect(railIndexForMethod(kenya, "crypto")).toBe(0);
    expect(railIndexForMethod(kenya, null)).toBe(0);
  });

  it("tolerates missing or empty rails", () => {
    expect(railIndexForMethod(undefined, "bank")).toBe(0);
    expect(railIndexForMethod([], "bank")).toBe(0);
  });
});

describe("sendRailHasChoice", () => {
  const kenya = [{ type: "mobile" }, { type: "bank" }];
  const southAfrica = [{ type: "bank" }];

  it("hides the rail picker when the method already fixed the rail", () => {
    expect(sendRailHasChoice(kenya, "bank")).toBe(false);
    expect(sendRailHasChoice(kenya, "mobile")).toBe(false);
  });

  it("shows the rail picker when the method does not imply one", () => {
    expect(sendRailHasChoice(kenya, null)).toBe(true);
  });

  it("hides the rail picker when there is only one rail to choose", () => {
    expect(sendRailHasChoice(southAfrica, null)).toBe(false);
  });

  it("keeps the rail picker when the method fell back to another rail", () => {
    // Mobile money + a country with no mobile rail: railIndexForMethod
    // degrades to the bank rail, so the user must be able to see that.
    const egypt = [{ type: "bank" }, { type: "bank" }];
    expect(railIndexForMethod(egypt, "mobile")).toBe(0);
    expect(sendRailHasChoice(egypt, "mobile")).toBe(true);
  });

  it("tolerates missing rails", () => {
    expect(sendRailHasChoice(undefined, null)).toBe(false);
  });
});
