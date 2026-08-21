import { describe, expect, it } from "vitest";
import {
  assertSufficientBalance,
  convertAmountWithRates,
  currentBalanceFromAccount,
  describeDisplayTotalSub,
  displayCurrencyOptionsFromRates,
  formatAccountBalance,
  formatCurrencyBalanceLines,
  formatHomeTotalBalance,
  formatHeroTotalLabel,
  formatSummedBalance,
  formatUsdEquivalentSub,
  parseBalanceNumber,
  pendingBalanceFromAccount,
  resolveDisplayCurrency,
  sumAvailableBalances,
  sumBalancesByCurrency,
  totalBalanceInDisplayCurrency,
} from "@/lib/services/balances";

describe("formatAccountBalance", () => {
  it("prefers available and formats", () => {
    expect(
      formatAccountBalance({ available: "337.54", current: "400", currency: "USDC" }),
    ).toBe("337.54");
  });

  it("returns em dash when missing", () => {
    expect(formatAccountBalance(null)).toBe("—");
    expect(formatAccountBalance({})).toBe("—");
  });
});

describe("pendingBalanceFromAccount", () => {
  it("returns the booked amount above the available balance", () => {
    expect(
      pendingBalanceFromAccount({
        available: "1,200.25",
        current: "1,500.50",
        currency: "USD",
      }),
    ).toEqual({ available: "300.25", current: "300.25", currency: "USD" });
  });

  it("does not infer pending money when either partner value is missing", () => {
    expect(pendingBalanceFromAccount({ current: "500", currency: "USD" })).toBeNull();
    expect(pendingBalanceFromAccount({ available: "500", currency: "USD" })).toBeNull();
  });

  it("returns zero when no booked money is pending", () => {
    expect(
      pendingBalanceFromAccount({ available: "500", current: "500", currency: "USD" }),
    ).toEqual({ available: "0", current: "0", currency: "USD" });
    expect(
      pendingBalanceFromAccount({ available: "600", current: "500", currency: "USD" }),
    ).toEqual({ available: "0", current: "0", currency: "USD" });
  });
});

describe("currentBalanceFromAccount", () => {
  it("uses booked current balance for the headline total", () => {
    expect(
      currentBalanceFromAccount({ available: "500", current: "650", currency: "USD" }),
    ).toEqual({ available: "650", current: "650", currency: "USD" });
  });

  it("falls back to available when the partner omits current", () => {
    expect(currentBalanceFromAccount({ available: "500", currency: "USD" })).toEqual({
      available: "500",
      current: "500",
      currency: "USD",
    });
  });
});

describe("assertSufficientBalance", () => {
  it("throws when amount exceeds available", () => {
    expect(() =>
      assertSufficientBalance({
        amount: "400",
        balance: { available: "337.54", currency: "USDC" },
        currency: "USDC",
      }),
    ).toThrow(/Insufficient USDC/);
  });

  it("allows when under available", () => {
    expect(() =>
      assertSufficientBalance({
        amount: "100",
        balance: { available: "337.54", currency: "USDC" },
        currency: "USDC",
      }),
    ).not.toThrow();
  });

  it("skips when balance unknown", () => {
    expect(() =>
      assertSufficientBalance({
        amount: "999999",
        balance: null,
        currency: "USDC",
      }),
    ).not.toThrow();
  });
});

describe("sumAvailableBalances", () => {
  it("sums known balances only", () => {
    expect(
      sumAvailableBalances([
        { available: "100" },
        { available: "37.54" },
        null,
      ]),
    ).toBeCloseTo(137.54);
    expect(formatSummedBalance([{ available: "100" }, { available: "37.5" }])).toBe(
      "137.50",
    );
    expect(parseBalanceNumber({ available: "10.5" })).toBe(10.5);
  });
});

describe("sumBalancesByCurrency / formatHomeTotalBalance", () => {
  it("collapses same-currency rails and never FX-sums unlike codes", () => {
    const items = [
      { currency: "USDC", balance: { available: "300" } },
      { currency: "USDC", balance: { available: "38.79" } },
      { currency: "EUR", balance: { available: "810.20" } },
      { currency: "USD", balance: { available: "10" } },
      { currency: "GBP", balance: null },
    ];
    expect(sumBalancesByCurrency(items)).toEqual([
      { currency: "EUR", total: 810.2, label: "810.20" },
      { currency: "USDC", total: 338.79, label: "338.79" },
      { currency: "USD", total: 10, label: "10.00" },
    ]);
    expect(formatCurrencyBalanceLines(items)).toEqual([
      "810.20 EUR",
      "338.79 USDC",
      "10.00 USD",
    ]);
    expect(formatHomeTotalBalance(items)).toBe("810.20 EUR · 338.79 USDC · 10.00 USD");
  });

  it("returns em dash / empty when nothing known", () => {
    expect(formatHomeTotalBalance([])).toBe("—");
    expect(formatHomeTotalBalance([{ currency: "EUR", balance: null }])).toBe("—");
    expect(formatCurrencyBalanceLines([])).toEqual([]);
  });

  it("formats a single-currency total with the code", () => {
    expect(
      formatHomeTotalBalance([
        { currency: "USDC", balance: { available: "100" } },
        { currency: "USDC", balance: { available: "37.5" } },
      ]),
    ).toBe("137.50 USDC");
  });
});

describe("displayCurrencyOptionsFromRates / resolveDisplayCurrency", () => {
  it("lists only the FX base, quoted codes, and USDC", () => {
    expect(
      displayCurrencyOptionsFromRates({
        base: "USD",
        rates: {
          KES: 131.81,
          NGN: 1347.92,
          GHS: 12.93,
          UGX: 3759.36,
          TZS: 2645.5,
          ZAR: 16.61,
          MWK: 1737,
        },
      }),
    ).toEqual(["USD", "KES", "TZS", "NGN", "GHS", "UGX", "ZAR", "MWK", "USDC"]);
  });

  it("does not invent EUR/GBP/CAD when rates omit them", () => {
    const options = displayCurrencyOptionsFromRates({
      base: "USD",
      rates: { KES: 130 },
    });
    expect(options).toEqual(["USD", "KES", "USDC"]);
    expect(options).not.toContain("EUR");
    expect(options).not.toContain("GBP");
    expect(options).not.toContain("CAD");
  });

  it("falls back to USD/USDC when FX is missing", () => {
    expect(displayCurrencyOptionsFromRates(null)).toEqual(["USD", "USDC"]);
  });

  it("includes EUR only when the rate book quotes it", () => {
    expect(
      displayCurrencyOptionsFromRates({
        base: "USD",
        rates: { KES: 130, EUR: 0.92 },
      }),
    ).toEqual(["USD", "EUR", "KES", "USDC"]);
  });

  it("clamps an unsupported stored preference to USD", () => {
    expect(resolveDisplayCurrency("EUR", ["USD", "KES", "USDC"])).toBe("USD");
    expect(resolveDisplayCurrency("KES", ["USD", "KES", "USDC"])).toBe("KES");
  });
});

describe("convertAmountWithRates / totalBalanceInDisplayCurrency", () => {
  const fx = {
    base: "USD",
    rates: { KES: 130, NGN: 1600, TZS: 2500 },
  };

  it("converts via USD base and keeps same-currency 1:1 without rates", () => {
    expect(convertAmountWithRates(10, "USD", "KES", fx)).toBeCloseTo(1300);
    expect(convertAmountWithRates(260, "KES", "USD", fx)).toBeCloseTo(2);
    expect(convertAmountWithRates(100, "EUR", "EUR", null)).toBe(100);
    expect(convertAmountWithRates(100, "EUR", "USD", fx)).toBeNull();
    expect(convertAmountWithRates(100, "USDC", "USD", fx)).toBe(100);
    expect(convertAmountWithRates(100, "USDC", "KES", fx)).toBeCloseTo(13000);
    expect(convertAmountWithRates(50, "USDT", "USD", null)).toBe(50);
  });

  it("sums convertible balances into one display currency and lists gaps", () => {
    const items = [
      { currency: "USD", balance: { available: "10" } },
      { currency: "KES", balance: { available: "1300" } },
      { currency: "EUR", balance: { available: "810.20" } },
      { currency: "USDC", balance: { available: "338.79" } },
    ];
    const usd = totalBalanceInDisplayCurrency(items, "USD", fx);
    expect(usd.total).toBeCloseTo(358.79);
    expect(usd.label).toBe("358.79 USD");
    expect(usd.included).toEqual(["KES", "USDC", "USD"]);
    expect(usd.excluded).toEqual(["EUR"]);
    expect(formatUsdEquivalentSub(usd.total)).toBe("≈ $358.79 USD");
    expect(formatHeroTotalLabel(usd.total, "USD")).toBe("≈ $358.79");

    const kes = totalBalanceInDisplayCurrency(items, "KES", fx);
    expect(kes.total).toBeCloseTo(46642.7);
    expect(kes.label).toBe("46,642.70 KES");
    expect(kes.excluded).toEqual(["EUR"]);
    expect(formatHeroTotalLabel(kes.total, "KES")).toBe("≈ KES 46,642.70");
    expect(formatHeroTotalLabel(null, "KES")).toBe("—");
  });

  it("returns em dash when nothing converts", () => {
    const result = totalBalanceInDisplayCurrency(
      [{ currency: "EUR", balance: { available: "10" } }],
      "USD",
      fx,
    );
    expect(result).toEqual({
      total: null,
      label: "—",
      included: [],
      excluded: ["EUR"],
    });
    expect(
      describeDisplayTotalSub(result, {
        balanceView: "all",
        displayCurrency: "USD",
      }),
    ).toBe("No FX rate for EUR → USD");
    expect(formatUsdEquivalentSub(null)).toBeNull();
  });

  it("describes indicative conversion when all included", () => {
    const result = totalBalanceInDisplayCurrency(
      [
        { currency: "USD", balance: { available: "10" } },
        { currency: "KES", balance: { available: "130" } },
      ],
      "USD",
      fx,
    );
    expect(
      describeDisplayTotalSub(result, {
        balanceView: "fiat",
        displayCurrency: "USD",
      }),
    ).toBe("Indicative FX → USD");
  });
});
