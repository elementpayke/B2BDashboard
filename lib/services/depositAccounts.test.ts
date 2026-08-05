import { describe, it, expect } from "vitest";
import {
  CURRENCY_OPTIONS,
  SUPPORTED_IBAN_CURRENCIES,
  buildCreateBankAccountPayload,
  isCurrencySupported,
} from "./depositAccounts";

describe("isCurrencySupported", () => {
  it("accepts the two the backend actually issues", () => {
    expect(isCurrencySupported("EUR")).toBe(true);
    expect(isCurrencySupported("USD")).toBe(true);
  });

  it("rejects the ones only present in the design", () => {
    // The mockup lists these, but DepositAccountCreateIn rejects them.
    for (const code of ["GBP", "KES", "NGN", "ZAR", "AED"]) {
      expect(isCurrencySupported(code)).toBe(false);
    }
  });

  it("is case- and whitespace-insensitive", () => {
    expect(isCurrencySupported(" eur ")).toBe(true);
  });
});

describe("buildCreateBankAccountPayload", () => {
  it("sends the normalised currency", () => {
    expect(buildCreateBankAccountPayload({ currency: "eur" })).toEqual({
      currency: "EUR",
    });
  });

  it("omits the account name rather than silently dropping it server-side", () => {
    // The API has no name field; Pydantic would discard it without complaint,
    // which would look to the user like the label had been saved.
    const body = buildCreateBankAccountPayload({
      currency: "USD",
      accountName: "Payroll",
    });

    expect(body).not.toHaveProperty("accountName");
    expect(body).not.toHaveProperty("account_name");
    expect(body).not.toHaveProperty("name");
  });

  it("includes a wallet address only when given", () => {
    expect(
      buildCreateBankAccountPayload({ currency: "USD", walletAddress: "0xabc" }),
    ).toEqual({ currency: "USD", wallet_address: "0xabc" });
    expect(buildCreateBankAccountPayload({ currency: "USD" })).not.toHaveProperty(
      "wallet_address",
    );
  });

  it("refuses an unsupported currency before it reaches the network", () => {
    expect(() => buildCreateBankAccountPayload({ currency: "KES" })).toThrow(
      /EUR and USD/,
    );
  });

  it("names the currency the user picked in the error", () => {
    expect(() => buildCreateBankAccountPayload({ currency: "GBP" })).toThrow(
      /GBP/,
    );
  });

  it("refuses an empty currency", () => {
    expect(() => buildCreateBankAccountPayload({ currency: "  " })).toThrow(
      /Choose a currency/,
    );
  });
});

describe("CURRENCY_OPTIONS", () => {
  it("keeps every currency from the design so the list still matches it", () => {
    expect(CURRENCY_OPTIONS.map((c) => c.code)).toEqual([
      "USD", "EUR", "GBP", "ZAR", "CAD", "AED", "NGN", "GHS", "KES", "TZS", "AUD",
    ]);
  });

  it("gives every option a flag code for the picker", () => {
    for (const option of CURRENCY_OPTIONS) {
      expect(option.iso).toMatch(/^[a-z]{2}$/);
    }
  });

  it("lists the supported currencies first", () => {
    const supported = CURRENCY_OPTIONS.slice(
      0,
      SUPPORTED_IBAN_CURRENCIES.length,
    ).map((c) => c.code);

    expect(new Set(supported)).toEqual(new Set(SUPPORTED_IBAN_CURRENCIES));
  });
});
