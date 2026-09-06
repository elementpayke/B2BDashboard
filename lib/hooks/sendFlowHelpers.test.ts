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

  it("maps a bare aggregator 400 into actionable recipient/amount copy", () => {
    const out = friendlySendQuoteError("Aggregator returned 400 for /partner/orders/quote", null, 400);
    expect(out).not.toMatch(/Aggregator|\/partner\//i);
    expect(out).toMatch(/couldn't price this payout/i);
  });

  it("prefers a concrete upstream message over the aggregator wrapper", () => {
    const out = friendlySendQuoteError(
      "Aggregator returned 400 for /partner/orders/quote",
      { upstream: { message: "Invalid account number for this bank" } },
      400,
    );
    expect(out).toMatch(/account number/i);
    expect(out).not.toMatch(/Aggregator returned/i);
  });

  it("humanizes an upstream minimum-amount rejection", () => {
    const out = friendlySendQuoteError(
      "Aggregator returned 400 for /partner/orders/quote",
      { upstream: { message: "Amount is below minimum amount for this corridor" } },
      400,
    );
    expect(out).toMatch(/Amount too small/i);
  });

  it("humanizes a plain minimum-amount backend message", () => {
    expect(friendlySendQuoteError("Amount is below the minimum for this corridor.")).toMatch(
      /Amount too small/i,
    );
  });

  it("maps structured data.field from partner preflight", () => {
    const out = friendlySendQuoteError(
      "Invalid payment method network for this corridor",
      { field: "payment_method.network_id" },
      422,
    );
    expect(out).toMatch(/payout rail isn't available/i);
    expect(out).not.toMatch(/Invalid payment method|Aggregator/i);
  });

  it("keeps provider-unavailable copy when network_id is required with data.field", () => {
    const out = friendlySendQuoteError(
      "payment_method.network_id is required for this rail",
      { field: "payment_method.network_id" },
      400,
    );
    expect(out).toMatch(/provider list is unavailable|can't be priced right now/i);
    expect(out).not.toMatch(/Pick another bank/i);
  });

  it("surfaces corridor min amount from thin partner payload", () => {
    const out = friendlySendQuoteError("Aggregator returned 422 for /partner/orders/quote", {
      field: "amount",
      min_amount: 50,
      currency: "KES",
    }, 422);
    expect(out).toMatch(/minimum of 50 KES/i);
  });

  it("keeps a concrete partner message instead of the generic 422 banner", () => {
    const out = friendlySendQuoteError(
      "No active payment channel matched this corridor and amount",
      null,
      422,
    );
    expect(out).toMatch(/No payout channel matched/i);
    expect(out).not.toMatch(/Some payout details need fixing/i);
  });

  it("preserves client balance checks that already name available funds", () => {
    const raw =
      "Insufficient USDT balance. Available 0.85; you entered 10.";
    expect(friendlySendQuoteError(raw)).toBe(raw);
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
