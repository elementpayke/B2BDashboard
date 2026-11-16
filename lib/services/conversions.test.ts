import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/apiClient", () => ({
  apiEnvelope: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});
import {
  LEDGER_FIAT_CURRENCIES,
  describeConversionRate,
  describeFiatFiatPath,
  filterCrossCurrencyFiatAccounts,
  formatConvertAmount,
  isLedgerFiatCurrency,
  needsUsdcBridge,
  pickPreferredConvertAccountId,
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

describe("pickPreferredConvertAccountId", () => {
  it("prefers the highest funded account", () => {
    expect(
      pickPreferredConvertAccountId([
        { id: "eur-empty", currency: "EUR", balanceAmount: 0 },
        { id: "usd-funded", currency: "USD", balanceAmount: 25 },
        { id: "gbp-small", currency: "GBP", balanceAmount: 2.92 },
      ]),
    ).toBe("usd-funded");
  });

  it("skips excluded ids", () => {
    expect(
      pickPreferredConvertAccountId(
        [
          { id: "a", currency: "EUR", balanceAmount: 10 },
          { id: "b", currency: "USD", balanceAmount: 5 },
        ],
        ["a"],
      ),
    ).toBe("b");
  });
});

describe("filterCrossCurrencyFiatAccounts", () => {
  it("drops same-currency destinations", () => {
    const rows = [
      { id: "1", currency: "EUR", balanceAmount: 0 },
      { id: "2", currency: "USD", balanceAmount: 10 },
      { id: "3", currency: "GBP", balanceAmount: 2 },
    ];
    expect(filterCrossCurrencyFiatAccounts(rows, "EUR", "1").map((a) => a.id)).toEqual([
      "2",
      "3",
    ]);
  });
});

describe("describeFiatFiatPath", () => {
  it("renders a direct fiat path", () => {
    expect(describeFiatFiatPath("EUR", "USD")).toBe("EUR → USD");
    expect(describeFiatFiatPath("EUR", "EUR")).toBeNull();
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

describe("conversionsApi.accept idempotency", () => {
  it("derives the default key from the quote id, so a retry deduplicates", async () => {
    const { conversionsApi } = await import("@/lib/services/conversions");
    const { apiEnvelope } = await import("@/lib/apiClient");
    const mocked = vi.mocked(apiEnvelope);
    mocked.mockResolvedValue({} as never);

    await conversionsApi.accept("q-123");
    await conversionsApi.accept("q-123");

    const keys = mocked.mock.calls.map(
      (call) => (call[3] as { headers?: Record<string, string> })?.headers?.["Idempotency-Key"],
    );
    expect(keys).toEqual(["conversion-accept:q-123", "conversion-accept:q-123"]);
  });

  it("still honours an explicit key", async () => {
    const { conversionsApi } = await import("@/lib/services/conversions");
    const { apiEnvelope } = await import("@/lib/apiClient");
    const mocked = vi.mocked(apiEnvelope);
    mocked.mockResolvedValue({} as never);

    await conversionsApi.accept("q-9", "caller-key");

    const opts = mocked.mock.calls[0][3] as { headers?: Record<string, string> };
    expect(opts.headers?.["Idempotency-Key"]).toBe("caller-key");
  });
});

describe("ledger fiat coverage", () => {
  it("covers every currency the aggregator's ledger rail converts", () => {
    // Mirrors LEDGER_FIAT_CURRENCIES in the aggregator's network_registry.py.
    // Drifting from that list is the bug this guards: too narrow silently
    // hides working currencies, too wide produces a 422 after the user
    // has already picked a pair.
    expect([...LEDGER_FIAT_CURRENCIES].sort()).toEqual(
      ["AED", "CAD", "EUR", "GBP", "GHS", "NGN", "USD"].sort(),
    );
  });

  it("excludes currencies a customer can hold but cannot convert", () => {
    // Holdable per the account catalog, rejected by customer_conversion.py.
    for (const code of ["KES", "TZS", "ZAR", "JPY", "CHF"]) {
      expect(isLedgerFiatCurrency(code)).toBe(false);
    }
  });

  it("treats the widened set as bridgeable, not just the original three", () => {
    expect(needsUsdcBridge("CAD", "NGN")).toBe(true);
    expect(needsUsdcBridge("AED", "GHS")).toBe(true);
    // Same currency is a book transfer, not a conversion.
    expect(needsUsdcBridge("CAD", "CAD")).toBe(false);
    // Holdable but unconvertible stays out.
    expect(needsUsdcBridge("KES", "USD")).toBe(false);
  });
});
