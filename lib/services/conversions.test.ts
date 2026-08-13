import { afterEach, describe, expect, it, vi } from "vitest";
import {
  describeConversionRate,
  formatConvertAmount,
  needsUsdcBridge,
  secondsUntilExpiry,
  validateConvertAmount,
} from "@/lib/services/conversions";

describe("validateConvertAmount", () => {
  it("accepts amounts at or above 1.00", () => {
    expect(validateConvertAmount("1")).toBe("1");
    expect(validateConvertAmount("25.50")).toBe("25.50");
  });

  it("rejects amounts below 1.00", () => {
    expect(() => validateConvertAmount("0.99")).toThrow(/Minimum convert amount/);
    expect(() => validateConvertAmount("")).toThrow(/Minimum convert amount/);
  });
});

describe("needsUsdcBridge", () => {
  it("is true for distinct fiat pairs", () => {
    expect(needsUsdcBridge("EUR", "USD")).toBe(true);
    expect(needsUsdcBridge("gbp", "eur")).toBe(true);
  });

  it("is false for fiat↔USDC or same fiat", () => {
    expect(needsUsdcBridge("EUR", "USDC")).toBe(false);
    expect(needsUsdcBridge("USDC", "USD")).toBe(false);
    expect(needsUsdcBridge("EUR", "EUR")).toBe(false);
  });
});

describe("formatConvertAmount / describeConversionRate", () => {
  it("formats and describes a quote", () => {
    expect(formatConvertAmount("10")).toMatch(/10/);
    expect(
      describeConversionRate({
        id: "c1",
        status: "quoted",
        direction: "fiat_to_stable",
        source_account_id: "1",
        destination_account_id: "2",
        source_currency: "EUR",
        destination_currency: "USDC",
        source_amount: "10",
        destination_amount: "11",
        fee_amount: null,
        fee_currency: null,
        quote_id: "q1",
        order_id: null,
        ledger_journal_reference: null,
        expires_at: null,
      }),
    ).toContain("1 EUR");
  });
});

describe("secondsUntilExpiry", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("treats naive ISO timestamps as UTC", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-12T17:18:00Z"));
    // Without the UTC fix this would parse as local and go negative in UTC+3.
    expect(secondsUntilExpiry("2026-08-12T17:21:00")).toBe(180);
    expect(secondsUntilExpiry("2026-08-12T17:21:00Z")).toBe(180);
  });
});
