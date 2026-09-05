import { describe, it, expect } from "vitest";
import { ApiRequestError } from "@/lib/apiClient";
import {
  buildSendQuotePayload,
  buildDepositQuotePayload,
  buildPaymentInstructionRows,
  formatQuoteFees,
  isQuoteExpiredError,
  isQuoteAlreadyAcceptedError,
  newIdempotencyKey,
  type PaymentInstructions,
} from "./orders";

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

  it("includes destination.networkId when a real catalog provider id is supplied", () => {
    const payload = buildSendQuotePayload({
      ...baseParams,
      railType: "mobile",
      networkId: "7ea6df5c-6bba-46b2-a7e6-f511959e7edb",
    });
    expect(payload.destination.networkId).toBe("7ea6df5c-6bba-46b2-a7e6-f511959e7edb");
  });

  it("includes destination.networkName for receipt bank/network labels", () => {
    const payload = buildSendQuotePayload({
      ...baseParams,
      railType: "bank",
      networkId: "bank-uuid",
      networkName: "Access Bank",
    });
    expect(payload.destination.networkName).toBe("Access Bank");
  });

  it("omits destination.networkId rather than sending an empty string when the catalog has no match", () => {
    const payload = buildSendQuotePayload({ ...baseParams, railType: "mobile" });
    expect(payload.destination).not.toHaveProperty("networkId");
  });

  it("forwards an explicit Stellar USDC asset", () => {
    const payload = buildSendQuotePayload({
      ...baseParams,
      railType: "mobile",
      refundAddress: "GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ",
      asset: { currency: "USDC", network: "Stellar" },
    });
    expect(payload.asset).toEqual({ currency: "USDC", network: "Stellar" });
  });
});

describe("isQuoteExpiredError", () => {
  it("recognizes a 410 as a quote-expired error", () => {
    expect(isQuoteExpiredError(new ApiRequestError("Quote expired", 410))).toBe(true);
  });

  it("does not classify other statuses as quote-expired", () => {
    expect(isQuoteExpiredError(new ApiRequestError("Not found", 404))).toBe(false);
    expect(isQuoteExpiredError(new Error("network down"))).toBe(false);
    expect(isQuoteExpiredError(null)).toBe(false);
  });
});

describe("isQuoteAlreadyAcceptedError", () => {
  it("recognizes a 409 as an already-accepted conflict", () => {
    expect(isQuoteAlreadyAcceptedError(new ApiRequestError("Quote already accepted.", 409))).toBe(
      true,
    );
  });

  it("does not classify other statuses as an accept conflict", () => {
    expect(isQuoteAlreadyAcceptedError(new ApiRequestError("Quote expired", 410))).toBe(false);
    expect(isQuoteAlreadyAcceptedError(null)).toBe(false);
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


const depositParams = {
  currency: "kes",
  countryIso: "ke",
  payerAccountNumber: "0712345678",
  payerName: "Acme Payments Ltd",
  amount: "800",
  walletAddress: "0xde0B295669a9FD93d5F28D9Ec85E40f4cb697BAe",
};

describe("buildDepositQuotePayload", () => {
  it("always sets order_type to OnRamp for a top-up (fiat in, crypto to our own wallet)", () => {
    const payload = buildDepositQuotePayload({ ...depositParams, railType: "mobile" });
    expect(payload.order_type).toBe("OnRamp");
  });

  it("maps a 'mobile' rail to accountType 'momo'", () => {
    const payload = buildDepositQuotePayload({ ...depositParams, railType: "mobile" });
    expect(payload.source.accountType).toBe("momo");
  });

  it("maps a 'bank' rail to accountType 'bank'", () => {
    const payload = buildDepositQuotePayload({ ...depositParams, railType: "bank" });
    expect(payload.source.accountType).toBe("bank");
  });

  it("throws rather than guessing for an unrecognized rail type", () => {
    expect(() =>
      buildDepositQuotePayload({ ...depositParams, railType: "carrier_pigeon" }),
    ).toThrow(/Unsupported rail type/);
  });

  it("uppercases currency and country per the backend's ISO code requirements", () => {
    const payload = buildDepositQuotePayload({ ...depositParams, railType: "mobile" });
    expect(payload.currency).toBe("KES");
    expect(payload.country).toBe("KE");
    expect(payload.source.countryCode).toBe("KE");
  });

  it("carries the amount as local_amount and the wallet address through untouched", () => {
    const payload = buildDepositQuotePayload({ ...depositParams, railType: "bank" });
    expect(payload.local_amount).toBe("800");
    expect(payload.wallet_address).toBe(depositParams.walletAddress);
    expect(payload.source.accountNumber).toBe("0712345678");
    expect(payload.source.accountName).toBe("Acme Payments Ltd");
  });

  it("normalises a mobile source number to E.164 using the corridor's dial code", () => {
    const payload = buildDepositQuotePayload({
      ...depositParams,
      railType: "mobile",
      dialCode: "254",
    });
    expect(payload.source.accountNumber).toBe("+254712345678");
  });

  it("never rewrites a bank account number", () => {
    const payload = buildDepositQuotePayload({
      ...depositParams,
      railType: "bank",
      payerAccountNumber: "0100234567",
      dialCode: "254",
    });
    expect(payload.source.accountNumber).toBe("0100234567");
  });

  it("includes source.networkId when a real catalog provider id is supplied", () => {
    const payload = buildDepositQuotePayload({
      ...depositParams,
      railType: "mobile",
      networkId: "7ea6df5c-6bba-46b2-a7e6-f511959e7edb",
    });
    expect(payload.source.networkId).toBe("7ea6df5c-6bba-46b2-a7e6-f511959e7edb");
  });

  it("omits source.networkId rather than sending an empty string when the catalog has no match", () => {
    const payload = buildDepositQuotePayload({ ...depositParams, railType: "mobile" });
    expect(payload.source).not.toHaveProperty("networkId");
  });

  it("forwards an explicit Stellar USDC asset", () => {
    const payload = buildDepositQuotePayload({
      ...depositParams,
      railType: "mobile",
      walletAddress: "GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ",
      asset: { currency: "USDC", network: "Stellar" },
    });
    expect(payload.asset).toEqual({ currency: "USDC", network: "Stellar" });
  });
});

describe("buildPaymentInstructionRows", () => {
  it("returns no rows for a missing instructions object", () => {
    expect(buildPaymentInstructionRows(null)).toEqual([]);
    expect(buildPaymentInstructionRows(undefined)).toEqual([]);
  });

  it("renders bank instructions from the top-level fields", () => {
    const instructions: PaymentInstructions = {
      type: "bank",
      account_number: "1234567890",
      bank_name: "Test Bank",
      account_holder_name: "ElementPay Ltd",
      reference: "EP-800",
    };
    expect(buildPaymentInstructionRows(instructions)).toEqual([
      { k: "Account number", v: "1234567890" },
      { k: "Bank", v: "Test Bank" },
      { k: "Account name", v: "ElementPay Ltd" },
      { k: "Reference", v: "EP-800" },
    ]);
  });

  it("falls back to bank_info when the top-level bank fields are null", () => {
    const instructions: PaymentInstructions = {
      type: "bank",
      bank_info: { accountNumber: "999", bankName: "Fallback Bank" },
    };
    expect(buildPaymentInstructionRows(instructions)).toEqual([
      { k: "Account number", v: "999" },
      { k: "Bank", v: "Fallback Bank" },
    ]);
  });

  it("renders momo instructions from the source block", () => {
    const instructions: PaymentInstructions = {
      type: "momo",
      source: { accountNumber: "+254711111111", networkName: "Mobile Wallet" },
    };
    expect(buildPaymentInstructionRows(instructions)).toEqual([
      { k: "Phone", v: "+254711111111" },
      { k: "Method", v: "Mobile money" },
    ]);
  });

  it("renders crypto_deposit instructions (OffRamp payout side)", () => {
    const instructions: PaymentInstructions = {
      type: "crypto_deposit",
      wallet_address: "0x4444444444444444444444444444444444444444",
      amount: "20",
      currency: "USDC",
      network: "BASE",
    };
    expect(buildPaymentInstructionRows(instructions)).toEqual([
      { k: "Address", v: "0x4444444444444444444444444444444444444444" },
      { k: "Amount", v: "20" },
      { k: "Asset", v: "USDC" },
      { k: "Network", v: "BASE" },
    ]);
  });

  it("renders the Stellar memo required for an off-ramp deposit", () => {
    const instructions: PaymentInstructions = {
      type: "crypto_deposit",
      wallet_address: "GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ",
      amount: "20",
      currency: "USDC",
      network: "STELLAR",
      memo: "MBOKA-4821",
      memo_type: "text",
    };
    expect(buildPaymentInstructionRows(instructions)).toContainEqual({
      k: "Memo",
      v: "MBOKA-4821",
    });
  });

  it("appends an expiry row when present, regardless of type", () => {
    const instructions: PaymentInstructions = {
      type: "momo",
      source: { accountNumber: "+254711111111" },
      expires_at: "2026-06-09T12:30:00Z",
    };
    const rows = buildPaymentInstructionRows(instructions);
    expect(rows.at(-1)?.k).toBe("Expires");
  });

  it("never renders a null field as the literal string 'null'", () => {
    const instructions: PaymentInstructions = { type: "bank" };
    const rows = buildPaymentInstructionRows(instructions);
    expect(rows.some((r) => r.v === "null")).toBe(false);
  });
});

describe("newIdempotencyKey", () => {
  it("returns a non-empty string", () => {
    expect(typeof newIdempotencyKey()).toBe("string");
    expect(newIdempotencyKey().length).toBeGreaterThan(0);
  });

  it("returns a different key on each call", () => {
    expect(newIdempotencyKey()).not.toBe(newIdempotencyKey());
  });
});
