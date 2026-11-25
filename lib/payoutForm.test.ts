import { describe, expect, it } from "vitest";

import { ApiRequestError } from "@/lib/apiClient";

import {
  bankOptionLabel,
  buildPayoutPreviewBody,
  EMPTY_PAYOUT_BANK_FORM,
  fiatSendOpensBankPayout,
  kesPayoutMinAmountHint,
  methodBankInputFields,
  normalizePayoutBanks,
  payoutApiErrorMessage,
  payoutMethodKey,
  usesBankCodePayoutForm,
  usesSchemePayoutForm,
  validateSchemePayoutFields,
} from "./payoutForm";

describe("usesBankCodePayoutForm", () => {
  it("is true for KES ke_eft discovery rows", () => {
    expect(
      usesBankCodePayoutForm({
        scheme: "ke_eft",
        country: "KE",
        required_fields: ["bank_code", "account_number", "bank_name"],
      }),
    ).toBe(true);
  });

  it("is false for Interac email discovery rows", () => {
    expect(
      usesBankCodePayoutForm({
        scheme: "interac_email",
        country: "CA",
        required_fields: ["email", "account_holder_name", "country"],
      }),
    ).toBe(false);
  });

  it("is false for legacy Interac method rows without required_fields", () => {
    expect(usesBankCodePayoutForm({ id: "interac", label: "Interac e-Transfer" })).toBe(false);
  });
});

describe("usesSchemePayoutForm", () => {
  it("is true when required_fields are present", () => {
    expect(
      usesSchemePayoutForm({
        scheme: "interac_email",
        required_fields: ["email", "account_holder_name", "country"],
      }),
    ).toBe(true);
  });

  it("is false for legacy rows", () => {
    expect(usesSchemePayoutForm({ id: "interac" })).toBe(false);
  });
});

describe("methodBankInputFields", () => {
  it("hides country when method pins CA", () => {
    expect(
      methodBankInputFields(
        {
          scheme: "interac_email",
          country: "CA",
          required_fields: ["email", "account_holder_name", "country"],
          optional_fields: ["security_question", "security_answer"],
        },
        "CAD",
      ),
    ).toEqual(["email", "account_holder_name"]);
  });

  it("uses bank directory and hides free-text bank_name for ke_eft", () => {
    expect(
      methodBankInputFields(
        {
          scheme: "ke_eft",
          country: "KE",
          required_fields: [
            "bank_code",
            "account_number",
            "bank_name",
            "country",
            "account_holder_name",
          ],
        },
        "KES",
      ),
    ).toEqual(["bank_code", "account_number", "account_holder_name"]);
  });

  it("includes require_one_of for SWIFT", () => {
    expect(
      methodBankInputFields(
        {
          scheme: "swift",
          required_fields: ["swift_bic", "bank_name", "country", "account_holder_name"],
          require_one_of: [["iban", "account_number"]],
        },
        "GBP",
      ),
    ).toEqual(["swift_bic", "bank_name", "country", "account_holder_name", "iban", "account_number"]);
  });
});

describe("buildPayoutPreviewBody", () => {
  const kesMethod = {
    scheme: "ke_eft",
    country: "KE",
    required_fields: ["bank_code", "account_number", "bank_name", "account_holder_name"],
  };

  const beneficiary = {
    firstName: "Jane",
    lastName: "Doe",
    email: "jane@example.com",
    line1: "1 Street",
    city: "Nairobi",
    postalCode: "00100",
    country: "KE",
  };

  it("builds beneficiary + bank for bank-code rails", () => {
    const body = buildPayoutPreviewBody({
      amount: "5000",
      currency: "KES",
      method: kesMethod,
      methodIndex: 0,
      bankName: "KCB",
      beneficiary,
      bank: {
        bankCode: "01",
        accountNumber: "1234567890",
        accountHolderName: "Jane Doe",
        email: "",
        iban: "",
        routingNumber: "",
        bankInstitutionNumber: "",
        transitNumber: "",
        swiftBic: "",
        bankName: "",
        accountType: "checking",
        country: "KE",
      },
    });
    expect(body).toMatchObject({
      amount: "5000",
      beneficiary: {
        first_name: "Jane",
        last_name: "Doe",
        address: { postal_code: "00100", country: "KE" },
      },
      bank: {
        scheme: "ke_eft",
        bank_code: "01",
        account_number: "1234567890",
        country: "KE",
      },
    });
    expect(body).not.toHaveProperty("destination");
  });

  it("builds Interac email bank + beneficiary (not legacy destination)", () => {
    const body = buildPayoutPreviewBody({
      amount: "250",
      currency: "CAD",
      method: {
        scheme: "interac_email",
        country: "CA",
        required_fields: ["email", "account_holder_name", "country"],
        optional_fields: ["security_question", "security_answer"],
      },
      methodIndex: 0,
      beneficiary: { ...beneficiary, city: "Toronto", postalCode: "M5V1A1", country: "CA" },
      bank: {
        bankCode: "",
        accountNumber: "",
        accountHolderName: "Jane Doe",
        email: "pay@acme.com",
        iban: "",
        routingNumber: "",
        bankInstitutionNumber: "",
        transitNumber: "",
        swiftBic: "",
        bankName: "",
        accountType: "checking",
        country: "CA",
      },
      security: {
        securityQuestion: "Favourite colour?",
        securityAnswer: "blue",
      },
    });
    expect(body).toMatchObject({
      amount: "250",
      bank: {
        scheme: "interac_email",
        email: "pay@acme.com",
        account_holder_name: "Jane Doe",
        country: "CA",
      },
      security_question: "Favourite colour?",
      security_answer: "blue",
    });
    expect(body).not.toHaveProperty("destination");
  });

  it("omits security Q&A when the method does not declare them", () => {
    const body = buildPayoutPreviewBody({
      amount: "250",
      currency: "CAD",
      method: {
        scheme: "eft",
        country: "CA",
        required_fields: [
          "bank_institution_number",
          "transit_number",
          "account_number",
          "bank_name",
          "country",
          "account_holder_name",
        ],
      },
      methodIndex: 0,
      beneficiary: { ...beneficiary, city: "Toronto", postalCode: "M5V1A1", country: "CA" },
      bank: {
        bankCode: "",
        accountNumber: "1234567",
        accountHolderName: "Jane Doe",
        email: "",
        iban: "",
        routingNumber: "",
        bankInstitutionNumber: "001",
        transitNumber: "12345",
        swiftBic: "",
        bankName: "RBC",
        accountType: "checking",
        country: "US",
      },
      security: {
        securityQuestion: "Favourite colour?",
        securityAnswer: "blue",
      },
    });
    expect(body.bank).toMatchObject({ country: "CA" });
    expect(body).not.toHaveProperty("security_question");
    expect(body).not.toHaveProperty("security_answer");
  });

  it("builds SEPA body with iban", () => {
    const body = buildPayoutPreviewBody({
      amount: "100",
      currency: "EUR",
      method: {
        scheme: "sepa",
        required_fields: ["iban", "bank_name", "country", "account_holder_name"],
        optional_fields: ["swift_bic"],
      },
      methodIndex: 0,
      beneficiary: { ...beneficiary, city: "Berlin", postalCode: "10115", country: "DE" },
      bank: {
        bankCode: "",
        accountNumber: "",
        accountHolderName: "Jane Doe",
        email: "",
        iban: "DE89370400440532013000",
        routingNumber: "",
        bankInstitutionNumber: "",
        transitNumber: "",
        swiftBic: "",
        bankName: "Commerzbank",
        accountType: "checking",
        country: "DE",
      },
    });
    expect(body).toMatchObject({
      bank: {
        scheme: "sepa",
        iban: "DE89370400440532013000",
        bank_name: "Commerzbank",
        country: "DE",
      },
    });
  });

  it("keeps legacy simple destination shape for Interac-style methods", () => {
    const body = buildPayoutPreviewBody({
      amount: "250",
      currency: "CAD",
      method: { id: "interac", label: "Interac e-Transfer" },
      methodIndex: 0,
      simpleDestination: "pay@acme.com",
    });
    expect(body).toEqual({
      amount: "250",
      currency: "CAD",
      method: "interac",
      destination: { account: "pay@acme.com" },
    });
  });

  it("uses methodIndex for simple methods without scheme, id, or method", () => {
    const body = buildPayoutPreviewBody({
      amount: "100",
      currency: "CAD",
      method: { label: "Second rail" },
      methodIndex: 2,
      simpleDestination: "pay@acme.com",
    });
    expect(body.method).toBe("2");
  });
});

describe("validateSchemePayoutFields", () => {
  it("skips unmapped required discovery fields the UI cannot collect", () => {
    const err = validateSchemePayoutFields({
      method: {
        scheme: "custom",
        country: "CA",
        required_fields: ["email", "account_holder_name", "country", "unsupported_token"],
      },
      beneficiary: {
        firstName: "Jane",
        lastName: "Doe",
        email: "jane@example.com",
        line1: "1 King",
        city: "Toronto",
        postalCode: "M5V1A1",
        country: "CA",
      },
      bank: {
        ...EMPTY_PAYOUT_BANK_FORM,
        email: "pay@acme.com",
        accountHolderName: "Jane Doe",
        country: "CA",
      },
    });
    expect(err).toBeNull();
  });
});

describe("fiatSendOpensBankPayout", () => {
  it("includes CAD/USD/EUR as well as African bank-code fiats", () => {
    expect(fiatSendOpensBankPayout("CAD")).toBe(true);
    expect(fiatSendOpensBankPayout("USD")).toBe(true);
    expect(fiatSendOpensBankPayout("EUR")).toBe(true);
    expect(fiatSendOpensBankPayout("KES")).toBe(true);
    expect(fiatSendOpensBankPayout("USDC")).toBe(false);
  });
});

describe("normalizePayoutBanks", () => {
  it("unwraps banks array", () => {
    expect(normalizePayoutBanks({ banks: [{ bank_code: "01" }] })).toEqual([{ bank_code: "01" }]);
  });
});

describe("payoutMethodKey", () => {
  it("prefers scheme", () => {
    expect(payoutMethodKey({ scheme: "ke_eft" }, 0)).toBe("ke_eft");
  });
});

describe("kesPayoutMinAmountHint", () => {
  it("returns copy only for KES", () => {
    expect(kesPayoutMinAmountHint("KES")).toMatch(/5,000/);
    expect(kesPayoutMinAmountHint("CAD")).toBeNull();
  });
});

describe("payoutApiErrorMessage", () => {
  it("formats min_amount from Mboka error data", () => {
    const err = new ApiRequestError("Payout preview failed.", 400, { min_amount: "5000.00" });
    expect(payoutApiErrorMessage(err, "KES")).toBe("Minimum payout amount is 5000.00 KES.");
  });
});

describe("bankOptionLabel", () => {
  it("disambiguates duplicate codes with name and code", () => {
    expect(bankOptionLabel({ bank_code: "01", bank_name: "KCB" }, 0)).toBe("KCB (01)");
  });
});
