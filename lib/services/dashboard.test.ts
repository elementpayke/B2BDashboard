import { describe, expect, it } from "vitest";
import {
  liveRateRowsFromSummary,
  mergeExchangeRates,
  normalizeExchangeRates,
} from "./dashboard";

describe("liveRateRowsFromSummary", () => {
  it("returns em-dash placeholders when fx_rates are missing", () => {
    expect(liveRateRowsFromSummary(undefined)).toEqual([
      { pair: "USD/KES", value: "—" },
      { pair: "USD/NGN", value: "—" },
      { pair: "USDC/USD", value: "—" },
    ]);
    expect(liveRateRowsFromSummary(null)).toEqual([
      { pair: "USD/KES", value: "—" },
      { pair: "USD/NGN", value: "—" },
      { pair: "USDC/USD", value: "—" },
    ]);
  });

  it("formats preferred pairs from base + rates", () => {
    expect(
      liveRateRowsFromSummary({
        base: "USD",
        rates: { KES: 131.64, NGN: 1382.84, USDC: 1.0001 },
      }),
    ).toEqual([
      { pair: "USD/KES", value: "131.64" },
      { pair: "USD/NGN", value: "1,382.84" },
      { pair: "USD/USDC", value: "1.0001" },
    ]);
  });

  it("skips non-finite rates and fills from remaining quotes", () => {
    expect(
      liveRateRowsFromSummary({
        base: "USD",
        rates: { KES: Number.NaN, EUR: 0.92, GBP: 0.78 },
      }),
    ).toEqual([
      { pair: "USD/EUR", value: "0.92" },
      { pair: "USD/GBP", value: "0.78" },
    ]);
  });
});

describe("normalizeExchangeRates / mergeExchangeRates", () => {
  it("drops non-finite rates and uppercases codes", () => {
    expect(
      normalizeExchangeRates({
        base: "usd",
        rates: { kes: 130, bad: Number.NaN, zero: 0 },
      }),
    ).toEqual({ base: "USD", rates: { KES: 130 } });
  });

  it("merges later sources over earlier ones on the same base", () => {
    expect(
      mergeExchangeRates(
        { base: "USD", rates: { KES: 100, NGN: 1000 } },
        { base: "USD", rates: { KES: 130, TZS: 2500 } },
      ),
    ).toEqual({
      base: "USD",
      rates: { KES: 130, NGN: 1000, TZS: 2500 },
    });
  });
});
