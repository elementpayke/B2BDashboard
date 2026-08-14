import { describe, expect, it } from "vitest";
import {
  canEnterInLocalCurrency,
  describeAmountEquivalent,
  formatFeeDual,
  formatRateLine,
  indicativeRate,
  toPayloadUsdAmount,
} from "@/lib/services/sendAmount";

const RATES = { KES: 130.5, NGN: 1650, GHS: 14.2 };

describe("indicativeRate", () => {
  it("reads a USD-base rate case-insensitively", () => {
    expect(indicativeRate(RATES, "kes")).toBe(130.5);
  });

  it("rejects missing, zero, negative and non-finite rates", () => {
    expect(indicativeRate(RATES, "UGX")).toBeNull();
    expect(indicativeRate({ X: 0 }, "X")).toBeNull();
    expect(indicativeRate({ X: -3 }, "X")).toBeNull();
    expect(indicativeRate({ X: Number.NaN }, "X")).toBeNull();
    expect(indicativeRate(null, "KES")).toBeNull();
  });
});

describe("canEnterInLocalCurrency", () => {
  it("only offers the toggle for currencies we can actually convert", () => {
    expect(canEnterInLocalCurrency(RATES, "KES")).toBe(true);
    // Corridors the summary carries no rate for — UGX, TZS, ZAR, EGP…
    expect(canEnterInLocalCurrency(RATES, "UGX")).toBe(false);
  });
});

describe("toPayloadUsdAmount", () => {
  it("passes a USD entry through without rounding drift", () => {
    expect(toPayloadUsdAmount("1000", { currency: "USD", rate: 130.5 })).toBe("1000");
    expect(toPayloadUsdAmount("1000.55", { currency: "USD", rate: 130.5 })).toBe("1000.55");
  });

  it("converts a local entry to USD cents", () => {
    expect(toPayloadUsdAmount("130500", { currency: "KES", rate: 130.5 })).toBe("1000.00");
  });

  it("tolerates thousands separators and spaces", () => {
    expect(toPayloadUsdAmount("130,500", { currency: "KES", rate: 130.5 })).toBe("1000.00");
    expect(toPayloadUsdAmount("1 000", { currency: "USD", rate: null })).toBe("1000");
  });

  it("returns null for empty, zero, negative and junk input", () => {
    for (const bad of ["", "   ", "0", "-5", "abc"]) {
      expect(toPayloadUsdAmount(bad, { currency: "USD", rate: 130.5 })).toBeNull();
    }
  });

  it("refuses a local entry when there is no rate, rather than guessing", () => {
    expect(toPayloadUsdAmount("130500", { currency: "KES", rate: null })).toBeNull();
  });
});

describe("describeAmountEquivalent", () => {
  it("shows the local side while typing USD, marked as an estimate", () => {
    expect(describeAmountEquivalent("1000", { currency: "USD", rate: 130.5 }, "KES")).toBe(
      "≈ 130,500.00 KES",
    );
  });

  it("shows the USD side while typing local", () => {
    expect(describeAmountEquivalent("130500", { currency: "KES", rate: 130.5 }, "KES")).toBe(
      "≈ 1,000.00 USD",
    );
  });

  it("shows nothing rather than a fake figure when the rate is unknown", () => {
    expect(describeAmountEquivalent("1000", { currency: "USD", rate: null }, "UGX")).toBeNull();
  });

  it("shows nothing for an empty or invalid amount", () => {
    expect(describeAmountEquivalent("", { currency: "USD", rate: 130.5 }, "KES")).toBeNull();
  });
});

describe("formatRateLine", () => {
  it("renders the pair a user can check against the market", () => {
    expect(formatRateLine(130.5, "KES")).toBe("1 USD = 130.50 KES");
    expect(formatRateLine("1650", "ngn")).toBe("1 USD = 1,650.00 NGN");
  });

  it("keeps precision for thin rates without trailing noise", () => {
    expect(formatRateLine(0.9231, "EUR")).toBe("1 USD = 0.9231 EUR");
  });

  it("returns null instead of a broken line when there is no rate", () => {
    expect(formatRateLine(null, "KES")).toBeNull();
    expect(formatRateLine(0, "KES")).toBeNull();
    expect(formatRateLine("not-a-rate", "KES")).toBeNull();
  });
});

describe("formatFeeDual", () => {
  it("shows the fee in both currencies off the quoted rate", () => {
    expect(formatFeeDual("$1.20", 130.5, "KES")).toBe("$1.20 (≈ 156.60 KES)");
  });

  it("leaves a non-numeric fee alone", () => {
    expect(formatFeeDual("Included in the rate", 130.5, "KES")).toBe("Included in the rate");
  });

  it("falls back to the USD half when there is no rate, rather than inventing one", () => {
    expect(formatFeeDual("$1.20", null, "KES")).toBe("$1.20");
  });
});
