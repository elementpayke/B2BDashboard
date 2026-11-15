import { describe, expect, it } from "vitest";
import {
  amountExceedsBalance,
  canEnterInLocalCurrency,
  describeAmountEquivalent,
  formatFeeDual,
  formatRateLine,
  indicativeRate,
  maxAmountForBalance,
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
    for (const bad of ["", "   ", "0", "-5", "abc", "1e3", "0x10", "Infinity"]) {
      expect(toPayloadUsdAmount(bad, { currency: "USD", rate: 130.5 })).toBeNull();
    }
  });

  it("refuses a local entry when there is no rate, rather than guessing", () => {
    expect(toPayloadUsdAmount("130500", { currency: "KES", rate: null })).toBeNull();
  });
});

describe("maxAmountForBalance", () => {
  it("returns a USD max that does not exceed available balance", () => {
    expect(maxAmountForBalance(0.445, { currency: "USD", rate: null })).toBe("0.44");
    expect(maxAmountForBalance(0, { currency: "USD", rate: null })).toBeNull();
  });

  it("returns a local-currency max that converts within the available balance", () => {
    const mode = { currency: "KES", rate: 132.16 };
    const max = maxAmountForBalance(0.44, mode);
    expect(max).toBe("58.15");
    expect(Number(toPayloadUsdAmount(max!, mode))).toBeLessThanOrEqual(0.44);
  });

  it("does not guess a local max without an exchange rate", () => {
    expect(maxAmountForBalance(10, { currency: "KES", rate: null })).toBeNull();
  });
});

describe("amountExceedsBalance", () => {
  it("checks USD input against the source balance", () => {
    expect(amountExceedsBalance("0.45", { currency: "USD", rate: null }, 0.44)).toBe(true);
    expect(amountExceedsBalance("0.44", { currency: "USD", rate: null }, 0.44)).toBe(false);
    expect(amountExceedsBalance("0.45", { currency: "USD", rate: null }, null)).toBe(false);
  });

  it("converts local-currency input before comparing with the source balance", () => {
    const mode = { currency: "KES", rate: 132.16 };
    expect(amountExceedsBalance("60", mode, 0.44)).toBe(true);
    expect(amountExceedsBalance("58.15", mode, 0.44)).toBe(false);
  });
});

describe("amount + fee against balance (the fee is charged on top)", () => {
  const usd = { currency: "USD", rate: null };

  // The reported bug: exactly enough for the amount, not for amount + fee.
  it("flags the boundary where the amount fits but the amount plus fee does not", () => {
    expect(amountExceedsBalance("7000", usd, 7000)).toBe(false);
    expect(amountExceedsBalance("7000", usd, 7000, "17.50")).toBe(true);
    expect(amountExceedsBalance("7000", usd, 7017.5, "17.50")).toBe(false);
    // One cent short of covering both.
    expect(amountExceedsBalance("7000", usd, 7017.49, "17.50")).toBe(true);
  });

  it("leaves the check untouched when no fee has been quoted yet", () => {
    expect(amountExceedsBalance("7000", usd, 7000, null)).toBe(false);
    expect(amountExceedsBalance("7000", usd, 7000, undefined)).toBe(false);
    expect(amountExceedsBalance("7000", usd, 7000, "")).toBe(false);
    expect(amountExceedsBalance("7000", usd, 7000, "0")).toBe(false);
  });

  it("does not accumulate binary noise at the cent boundary", () => {
    expect(amountExceedsBalance("0.1", usd, 0.3, "0.2")).toBe(false);
    expect(amountExceedsBalance("1.005", usd, 1.015, "0.01")).toBe(false);
  });

  it("adds the fee in the converted currency's own terms via the USD payload", () => {
    const mode = { currency: "KES", rate: 132.16 };
    // 58.15 KES ≈ 0.44 USD, which exactly fits a 0.44 balance...
    expect(amountExceedsBalance("58.15", mode, 0.44)).toBe(false);
    // ...but not once a 0.05 USD fee rides on top.
    expect(amountExceedsBalance("58.15", mode, 0.44, 0.05)).toBe(true);
  });

  it("makes Max fill the largest amount whose amount plus fee still fits", () => {
    expect(maxAmountForBalance(7017.5, usd, "17.50")).toBe("7000.00");
    const filled = maxAmountForBalance(7017.5, usd, "17.50");
    expect(amountExceedsBalance(filled!, usd, 7017.5, "17.50")).toBe(false);
  });

  it("offers no Max when the fee alone would consume the balance", () => {
    expect(maxAmountForBalance(17.5, usd, "17.50")).toBeNull();
    expect(maxAmountForBalance(10, usd, "17.50")).toBeNull();
  });

  it("keeps the fee-less Max unchanged", () => {
    expect(maxAmountForBalance(0.445, usd)).toBe("0.44");
    expect(maxAmountForBalance(0.445, usd, null)).toBe("0.44");
  });

  it("round-trips a local-currency Max against the fee-aware check", () => {
    const mode = { currency: "KES", rate: 132.16 };
    const filled = maxAmountForBalance(10, mode, "0.44");
    expect(filled).not.toBeNull();
    expect(amountExceedsBalance(filled!, mode, 10, "0.44")).toBe(false);
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
