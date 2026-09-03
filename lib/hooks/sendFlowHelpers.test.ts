import { describe, it, expect } from "vitest";
import {
  buildSendDestinationSummary,
  buildSendStepDots,
  friendlySendAcceptError,
  friendlySendQuoteError,
  sendRailBlockedByMissingNetworkId,
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
        channelLabel: "Mobile money",
      }),
    ).toBe("Kenya · Mobile money");
  });

  it("formats a Stellar stablecoin destination", () => {
    expect(
      buildSendDestinationSummary({
        sendGroup: "crypto",
        sendAsset: "usdc",
        sendChainLabel: "Stellar",
        countryName: "Kenya",
        channelLabel: "Mobile money",
      }),
    ).toBe("USDC · Stellar");
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

describe("sendRailBlockedByMissingNetworkId", () => {
  const base = { sendGroup: "country", networkId: undefined, catalogSettled: true };

  it("blocks a country corridor with no aggregator institution id", () => {
    // Both bank and momo account types are rejected by the backend's own
    // validation without payment_method.network_id.
    expect(sendRailBlockedByMissingNetworkId(base)).toBe(true);
  });

  it("allows it once the catalog supplies an id", () => {
    expect(sendRailBlockedByMissingNetworkId({ ...base, networkId: "MPESA" })).toBe(false);
  });

  it("stays quiet while the catalog is still loading", () => {
    expect(sendRailBlockedByMissingNetworkId({ ...base, catalogSettled: false })).toBe(false);
  });

  it("does not apply to the stablecoin group, which never sends a networkId", () => {
    expect(sendRailBlockedByMissingNetworkId({ ...base, sendGroup: "crypto" })).toBe(false);
  });
});

describe("friendlySendQuoteError", () => {
  it("replaces the raw field-path error with something a user can act on", () => {
    const out = friendlySendQuoteError("payment_method.network_id is required for this rail");
    expect(out).not.toMatch(/network_id/);
    expect(out).toMatch(/can't be priced right now/i);
  });

  it("explains an aggregator credential failure as ours, not the user's", () => {
    const out = friendlySendQuoteError("Aggregator returned 401 for /partner/orders/quote");
    expect(out).toMatch(/temporarily unavailable/i);
    expect(out).toMatch(/not your details/i);
  });

  it("passes an ordinary backend message through untouched", () => {
    expect(friendlySendQuoteError("Amount is below the minimum for this corridor.")).toBe(
      "Amount is below the minimum for this corridor.",
    );
  });
});

describe("friendlySendAcceptError", () => {
  it("maps insufficient_balance to need/available copy", () => {
    const out = friendlySendAcceptError("Insufficient balance to fund this payment.", {
      code: "insufficient_balance",
      available: "0.25",
      amount: "1.00",
      currency: "USDT",
      network: "Polygon",
    });
    expect(out).toMatch(/Insufficient funds/i);
    expect(out).toMatch(/1(?:\.0+)? USDT on Polygon/);
    expect(out).toMatch(/Available 0\.25/);
  });

  it("maps below_minimum and asset_mismatch", () => {
    expect(
      friendlySendAcceptError("too small", {
        code: "below_minimum",
        amount: "0.25",
        currency: "USDT",
      }),
    ).toMatch(/Amount too small/i);
    expect(
      friendlySendAcceptError("mismatch", { code: "asset_mismatch" }),
    ).toMatch(/Settlement asset mismatch/i);
  });
});
