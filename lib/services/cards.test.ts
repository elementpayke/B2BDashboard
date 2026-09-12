import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  cardholderPrefillFromKybProfile,
  clearIssuedCardLivePatches,
  describeCardStatus,
  describeUsdFunding,
  describeUsdFundingIssueNote,
  formatCardExpiry,
  formatCardPan,
  formatMaskedPan,
  detectCardBrand,
  resolveCardBrand,
  isActiveUsdFundingAccount,
  isCardActionable,
  isCardFailedStatus,
  isCardFrozenStatus,
  isValidCardE164,
  isValidCardholderEmail,
  newCardReference,
  noteIssuedCardLivePatch,
  reconcileIssuedCardsList,
  resolveUsdFundingAccount,
  stripCardSecrets,
  type IssuedCard,
  type IssuedCardsList,
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
    expect(describeCardStatus("blocked")).toBe("Frozen");
    expect(describeCardStatus("pending")).toBe("Pending");
    expect(describeCardStatus("failed")).toBe("Failed");
    expect(describeCardStatus("closed")).toBe("Closed");
    expect(describeCardStatus(null)).toBe("Unknown");
  });
});

describe("isCardFailedStatus / isCardActionable", () => {
  it("treats failed and closed partner states as non-actionable", () => {
    expect(isCardFailedStatus("failed")).toBe(true);
    expect(isCardFailedStatus("terminated")).toBe(true);
    expect(isCardFailedStatus("active")).toBe(false);
    expect(isCardActionable({ status: "active", provider_ready: true })).toBe(true);
    expect(isCardActionable({ status: "failed", provider_ready: true })).toBe(false);
    expect(isCardActionable({ status: "active", provider_ready: false })).toBe(false);
  });
});

describe("isCardFrozenStatus", () => {
  it("treats frozen and blocked as non-spendable", () => {
    expect(isCardFrozenStatus("frozen")).toBe(true);
    expect(isCardFrozenStatus("BLOCKED")).toBe(true);
    expect(isCardFrozenStatus("active")).toBe(false);
  });
});

describe("stripCardSecrets", () => {
  it("nulls PAN and CVV without dropping other fields", () => {
    expect(
      stripCardSecrets({
        id: "4",
        account_id: "a",
        entity_id: "e",
        type: "virtual",
        status: "active",
        currency: "USD",
        number: "4111111111111111",
        cvv: "123",
        last_four: "1111",
      }),
    ).toMatchObject({
      id: "4",
      last_four: "1111",
      number: null,
      cvv: null,
    });
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

describe("reconcileIssuedCardsList", () => {
  const baseCard = (overrides: Partial<IssuedCard> = {}): IssuedCard => ({
    id: "card_1",
    account_id: "acct_1",
    entity_id: "ent_1",
    type: "virtual",
    status: "pending",
    currency: "USD",
    provider_ready: false,
    ...overrides,
  });

  const list = (cards: IssuedCard[]): IssuedCardsList => ({
    account_id: "acct_1",
    entity_id: "ent_1",
    cards,
  });

  beforeEach(() => {
    clearIssuedCardLivePatches();
  });

  it("does not restore cards the server no longer returns", () => {
    noteIssuedCardLivePatch("card_gone", 50);
    const reconciled = reconcileIssuedCardsList(
      list([baseCard({ id: "card_1", status: "active", provider_ready: true })]),
      list([
        baseCard({ id: "card_1", status: "active", provider_ready: true }),
        baseCard({ id: "card_gone", status: "active", provider_ready: true }),
      ]),
      100,
    );
    expect(reconciled.cards.map((card) => card.id)).toEqual(["card_1"]);
  });

  it("lets a later refetch correct stale cached status/provider_ready", () => {
    noteIssuedCardLivePatch("card_1", 10);
    const reconciled = reconcileIssuedCardsList(
      list([baseCard({ status: "frozen", provider_ready: false })]),
      list([baseCard({ status: "active", provider_ready: true })]),
      100,
    );
    expect(reconciled.cards[0]).toMatchObject({
      status: "frozen",
      provider_ready: false,
    });
  });

  it("keeps SSE patches that arrived during the in-flight fetch", () => {
    noteIssuedCardLivePatch("card_1", 150);
    const reconciled = reconcileIssuedCardsList(
      list([baseCard({ status: "pending", provider_ready: false })]),
      list([baseCard({ status: "active", provider_ready: true })]),
      100,
    );
    expect(reconciled.cards[0]).toMatchObject({
      status: "active",
      provider_ready: true,
    });
  });
});
