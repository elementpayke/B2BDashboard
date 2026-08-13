import { describe, expect, it } from "vitest";
import {
  cardholderPrefillFromKybProfile,
  describeCardStatus,
  describeUsdFunding,
  describeUsdFundingIssueNote,
  isActiveUsdFundingAccount,
  isValidCardE164,
  isValidCardholderEmail,
  newCardReference,
} from "./cards";

describe("isActiveUsdFundingAccount", () => {
  it("requires USD and an active status", () => {
    expect(
      isActiveUsdFundingAccount({ id: "64", currency: "USD", status: "active" }),
    ).toBe(true);
    expect(
      isActiveUsdFundingAccount({ id: "64", currency: "usd", status: "active" }),
    ).toBe(true);
    expect(
      isActiveUsdFundingAccount({ id: "63", currency: "EUR", status: "active" }),
    ).toBe(false);
    expect(
      isActiveUsdFundingAccount({ id: "64", currency: "USD", status: "pending" }),
    ).toBe(false);
    expect(
      isActiveUsdFundingAccount({ id: "", currency: "USD", status: "active" }),
    ).toBe(false);
  });
});

describe("cardholder validation", () => {
  it("accepts E.164 phones and rejects stubs", () => {
    expect(isValidCardE164("+12125550198")).toBe(true);
    expect(isValidCardE164("+1")).toBe(false);
    expect(isValidCardE164("12125550198")).toBe(false);
  });

  it("validates email shape", () => {
    expect(isValidCardholderEmail("jane@company.com")).toBe(true);
    expect(isValidCardholderEmail("cards@elementpay.local")).toBe(true);
    expect(isValidCardholderEmail("not-an-email")).toBe(false);
    expect(isValidCardholderEmail("")).toBe(false);
  });
});

describe("cardholderPrefillFromKybProfile", () => {
  it("reads associate person fields and never invents values", () => {
    expect(cardholderPrefillFromKybProfile(null)).toEqual({});
    expect(
      cardholderPrefillFromKybProfile({
        associates: [
          {
            full_name: { first_name: "Jane", last_name: "Doe" },
            phone_number: "+12125550198",
            email: "jane@acme.test",
          },
        ],
      }),
    ).toEqual({
      first_name: "Jane",
      last_name: "Doe",
      phone_number: "+12125550198",
      email: "jane@acme.test",
    });
  });
});

describe("describeUsdFunding", () => {
  it("describes linked USD without inventing balances", () => {
    expect(describeUsdFunding(null)).toMatch(/active USD deposit/);
    expect(
      describeUsdFunding({
        entityId: "20",
        accountId: "64",
        currency: "USD",
        balanceLabel: "10.00",
        status: "active",
        accountMask: "GB82 ···· 1234",
      }),
    ).toBe("Linked to active USD · GB82 ···· 1234 · available $10.00");
    expect(
      describeUsdFundingIssueNote({
        entityId: "20",
        accountId: "64",
        currency: "USD",
        balanceLabel: "10.00",
        status: "active",
      }),
    ).toMatch(/not a separate card wallet/);
  });
});

describe("newCardReference", () => {
  it("slugifies the label and stays unique per call", () => {
    const a = newCardReference("Marketing Ads");
    const b = newCardReference("Marketing Ads");
    expect(a).toMatch(/^card-marketing-ads-[a-z0-9]+$/i);
    expect(a).not.toBe(b);
  });
});

describe("describeCardStatus", () => {
  it("maps partner statuses to UI labels", () => {
    expect(describeCardStatus("active")).toBe("Active");
    expect(describeCardStatus("frozen")).toBe("Frozen");
    expect(describeCardStatus("pending")).toBe("Pending");
    expect(describeCardStatus(null)).toBe("Unknown");
  });
});
