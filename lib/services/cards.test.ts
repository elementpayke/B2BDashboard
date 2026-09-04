import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  cardholderPrefillFromKybProfile,
  describeCardStatus,
  describeUsdFunding,
  describeUsdFundingIssueNote,
  formatCardExpiry,
  formatCardPan,
  formatMaskedPan,
  detectCardBrand,
  resolveCardBrand,
  isActiveUsdFundingAccount,
  isValidCardE164,
  isValidCardholderEmail,
  newCardReference,
  resolveUsdFundingAccount,
} from "./cards";

// Stub only the network surface; the row/normalization helpers stay real.
vi.mock("./entities", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./entities")>();
  return {
    ...actual,
    entitiesApi: { ...actual.entitiesApi, list: vi.fn(), listAccounts: vi.fn() },
  };
});

beforeEach(() => {
  vi.clearAllMocks();
});

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

describe("resolveUsdFundingAccount", () => {
  const depositUsd = { id: "64", currency: "USD", status: "active" as const, iban: "US1234567890123456" };

  it("returns the entity that actually owns the deposit account id", async () => {
    const { entitiesApi } = await import("./entities");
    vi.mocked(entitiesApi.listAccounts).mockImplementation(async (entityId: string) =>
      entityId === "20"
        ? [{ id: "64", currency: "USD", asset_type: "fiat", status: "active" }]
        : [],
    );

    const funding = await resolveUsdFundingAccount({
      depositAccounts: [depositUsd],
      entities: [{ id: "19" }, { id: "20" }] as never,
    });
    expect(funding).toMatchObject({ entityId: "20", accountId: "64" });
  });

  it("does not pair the deposit account with an unverified entity", async () => {
    const { entitiesApi } = await import("./entities");
    // No entity owns account 64, and none exposes another USD account.
    vi.mocked(entitiesApi.listAccounts).mockResolvedValue([]);

    const funding = await resolveUsdFundingAccount({
      depositAccounts: [depositUsd],
      entities: [{ id: "19" }, { id: "20" }] as never,
    });
    expect(funding).toBeNull();
  });

  it("keeps scanning when one entity's account lookup fails", async () => {
    const { entitiesApi } = await import("./entities");
    vi.mocked(entitiesApi.listAccounts).mockImplementation(async (entityId: string) => {
      if (entityId === "19") throw new Error("upstream 503");
      return [{ id: "77", currency: "USD", asset_type: "fiat", status: "active" }];
    });

    const funding = await resolveUsdFundingAccount({
      depositAccounts: [],
      entities: [{ id: "19" }, { id: "20" }] as never,
    });
    expect(funding).toMatchObject({ entityId: "20", accountId: "77" });
  });
});

describe("formatCardPan / formatCardExpiry", () => {
  it("groups PAN digits and formats expiry", () => {
    expect(formatCardPan("4111111111119314")).toBe("4111 1111 1111 9314");
    expect(formatCardPan("4111-1111-1111-9314")).toBe("4111 1111 1111 9314");
    expect(formatCardPan("")).toBe("");
    expect(formatCardExpiry("12", "2030")).toBe("12/2030");
    expect(formatCardExpiry("", "2030")).toBeNull();
  });
});

describe("resolveCardBrand / formatMaskedPan", () => {
  it("detects brand from BIN and never invents last-four", () => {
    expect(detectCardBrand("5567666029351204")).toBe("mastercard");
    expect(detectCardBrand("4111111111111111")).toBe("visa");
    expect(resolveCardBrand({ brand: "MasterCard" })).toBe("mastercard");
    expect(resolveCardBrand({ number: "5567" })).toBe("mastercard");
    expect(formatMaskedPan("1204")).toBe("•••• •••• •••• 1204");
    expect(formatMaskedPan(null)).toBe("•••• •••• •••• ••••");
    expect(formatMaskedPan("----")).toBe("•••• •••• •••• ••••");
  });
});
