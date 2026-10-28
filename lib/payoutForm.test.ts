import { describe, expect, it } from "vitest";

import { ApiRequestError } from "@/lib/apiClient";

import {
  bankOptionLabel,
  buildPayoutPreviewBody,
  kesPayoutMinAmountHint,
  normalizePayoutBanks,
  payoutApiErrorMessage,
  payoutMethodKey,
  usesBankCodePayoutForm,
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

  it("is false for legacy Interac method rows without required_fields", () => {
    expect(usesBankCodePayoutForm({ id: "interac", label: "Interac e-Transfer" })).toBe(false);
  });
});

describe("buildPayoutPreviewBody", () => {
  const kesMethod = {
    scheme: "ke_eft",
    country: "KE",
    required_fields: ["bank_code", "account_number", "bank_name", "account_holder_name"],
  };

  it("builds beneficiary + bank for bank-code rails", () => {
    const body = buildPayoutPreviewBody({
      amount: "5000",
      currency: "KES",
      method: kesMethod,
      bankName: "KCB",
      beneficiary: {
        firstName: "Jane",
        lastName: "Doe",
        email: "jane@example.com",
        line1: "1 Street",
        city: "Nairobi",
        postalCode: "00100",
        country: "KE",
      },
      bank: {
        bankCode: "01",
        accountNumber: "1234567890",
        accountHolderName: "Jane Doe",
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

  it("keeps legacy simple destination shape for Interac-style methods", () => {
    const body = buildPayoutPreviewBody({
      amount: "250",
      currency: "CAD",
      method: { id: "interac", label: "Interac e-Transfer" },
      simpleDestination: "pay@acme.com",
    });
    expect(body).toEqual({
      amount: "250",
      currency: "CAD",
      method: "interac",
      destination: { account: "pay@acme.com" },
    });
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
