import { describe, it, expect } from "vitest";
import { buildSendQuotePayload, formatQuoteFees } from "./orders";

const baseParams = {
  currency: "kes",
  countryIso: "ke",
  recipientAccountNumber: "0712345678",
  recipientName: "Jane Mukami",
  amount: "50.00",
  refundAddress: "0x9F2c4a8b1E5d7a3c91F0bD2e4cAb7fE6Dd31B0c4a",
};

describe("buildSendQuotePayload", () => {
  it("maps a 'mobile' rail to accountType 'momo'", () => {
    const payload = buildSendQuotePayload({ ...baseParams, railType: "mobile" });
    expect(payload.destination.accountType).toBe("momo");
  });

  it("maps a 'bank' rail to accountType 'bank'", () => {
    const payload = buildSendQuotePayload({ ...baseParams, railType: "bank" });
    expect(payload.destination.accountType).toBe("bank");
  });

  it("throws rather than guessing for an unrecognized rail type", () => {
    expect(() => buildSendQuotePayload({ ...baseParams, railType: "carrier_pigeon" })).toThrow(
      /Unsupported rail type/,
    );
  });

  it("uppercases currency and country per the backend's ISO code requirements", () => {
    const payload = buildSendQuotePayload({ ...baseParams, railType: "mobile" });
    expect(payload.currency).toBe("KES");
    expect(payload.country).toBe("KE");
    expect(payload.destination.countryCode).toBe("KE");
  });

  it("always sets order_type to OffRamp for a payout (sending fiat out to a recipient)", () => {
    const payload = buildSendQuotePayload({ ...baseParams, railType: "mobile" });
    expect(payload.order_type).toBe("OffRamp");
  });

  it("carries the amount through as crypto_amount and the recipient fields onto destination", () => {
    const payload = buildSendQuotePayload({ ...baseParams, railType: "bank" });
    expect(payload.crypto_amount).toBe("50.00");
    expect(payload.destination.accountNumber).toBe("0712345678");
    expect(payload.destination.accountName).toBe("Jane Mukami");
    expect(payload.refund_address).toBe(baseParams.refundAddress);
  });
});

describe("mobile-money phone normalisation", () => {
  // Found live: the aggregator rejected a payout with
  //   "Invalid phone number for this corridor" / expected_dial_code 254
  // because the modal's KE placeholder is "0712 345 678" and the value was
  // passed through unchanged. Every mobile-money send failed.
  const base = {
    currency: "KES",
    countryIso: "ke",
    railType: "mobile",
    recipientName: "Jane Mukami",
    amount: "10",
    refundAddress: "0xabc",
    dialCode: "254",
  };
  const num = (recipientAccountNumber: string, over: Record<string, unknown> = {}) =>
    buildSendQuotePayload({ ...base, recipientAccountNumber, ...over } as never)
      .destination.accountNumber;

  it("converts a local leading-zero number to E.164", () => {
    expect(num("0712345678")).toBe("+254712345678");
  });

  it("accepts the placeholder's spaced format", () => {
    expect(num("0712 345 678")).toBe("+254712345678");
  });

  it("leaves an already-E.164 number alone", () => {
    expect(num("+254712345678")).toBe("+254712345678");
  });

  it("normalises a 00 international prefix", () => {
    expect(num("00254712345678")).toBe("+254712345678");
  });

  it("adds the plus to a bare country-code number", () => {
    expect(num("254712345678")).toBe("+254712345678");
  });

  it("strips punctuation", () => {
    expect(num("(0712) 345-678")).toBe("+254712345678");
  });

  it("uses the selected country's dial code, not a hardcoded one", () => {
    expect(
      num("0803 123 4567", { countryIso: "ng", currency: "NGN", dialCode: "234" }),
    ).toBe("+2348031234567");
  });

  it("never rewrites a bank account number", () => {
    // "0100234567" is a KE bank account, not a phone; mangling it would
    // send money to a different account.
    expect(num("0100234567", { railType: "bank" })).toBe("0100234567");
  });

  it("passes the number through untouched when no dial code is known", () => {
    expect(num("0712345678", { dialCode: undefined })).toBe("0712345678");
  });
});

describe("formatQuoteFees", () => {
  // The review step rendered `JSON.stringify(fees)`, so a real quote showed
  // the user: {"network_fee_usd":null,"service_fee_usd":null,...}
  it("sums the USD fee components", () => {
    expect(
      formatQuoteFees({ network_fee_usd: "0.30", service_fee_usd: "1.20" }),
    ).toBe("$1.50");
  });

  it("ignores the local-currency duplicates when USD is present", () => {
    expect(
      formatQuoteFees({ network_fee_usd: "0.50", network_fee_local: "64.10" }),
    ).toBe("$0.50");
  });

  it("says fees are included rather than claiming zero when all are null", () => {
    // The provider quoted no explicit fee. "$0.00" would be a promise we
    // cannot keep; the rate already carries the spread.
    expect(
      formatQuoteFees({ network_fee_usd: null, service_fee_usd: null }),
    ).toBe("Included in the rate");
  });

  it("handles a missing fee object", () => {
    expect(formatQuoteFees(null)).toBe("Included in the rate");
  });

  it("never leaks raw JSON", () => {
    const out = formatQuoteFees({ some_future_fee_usd: "2.00", note: "x" });
    expect(out).not.toContain("{");
    expect(out).not.toContain('"');
  });

  it("ignores non-numeric values", () => {
    expect(formatQuoteFees({ service_fee_usd: "n/a" })).toBe("Included in the rate");
  });
});
