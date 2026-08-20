import { describe, expect, it } from "vitest";
import {
  channelLabelForRail,
  displayChannelName,
  isInternalProviderName,
  transactionPartyLabel,
} from "./channelLabels";

describe("channelLabelForRail", () => {
  it("maps rail types to brand-neutral labels", () => {
    expect(channelLabelForRail("mobile")).toBe("Mobile money");
    expect(channelLabelForRail("bank")).toBe("Bank transfer");
    expect(channelLabelForRail("crypto")).toBe("Stablecoin");
  });
});

describe("isInternalProviderName", () => {
  it("treats aggregator slugs as internal", () => {
    expect(isInternalProviderName("yellowcard")).toBe(true);
    expect(isInternalProviderName("YellowCard")).toBe(true);
    expect(isInternalProviderName("")).toBe(true);
  });

  it("allows real counterparty names", () => {
    expect(isInternalProviderName("Acme Supplies Ltd")).toBe(false);
  });
});

describe("transactionPartyLabel", () => {
  it("never headlines aggregator or institution providers", () => {
    expect(
      transactionPartyLabel({ direction: "in", currency: "kes", provider: "yellowcard" }),
    ).toBe("Deposit · KES");
    expect(
      transactionPartyLabel({ direction: "out", currency: "KES", provider: "M-Pesa" }),
    ).toBe("Payout · KES");
    expect(
      transactionPartyLabel({
        direction: "out",
        currency: "KES",
        provider: "Acme Supplies Ltd",
      }),
    ).toBe("Payout · KES");
  });
});

describe("displayChannelName", () => {
  it("softens momo and bank institution names to rail labels", () => {
    expect(displayChannelName("mobile", "M-Pesa")).toBe("Mobile money");
    expect(displayChannelName("bank", "NATIONAL BANK OF KENYA")).toBe("Bank transfer");
    expect(displayChannelName("bank", "NCBA Bank")).toBe("Bank transfer");
  });
});
