import { describe, expect, it } from "vitest";
import {
  bankInstructionsText,
  formatCountdown,
  formatLimitsLine,
  limitViolation,
  providerLimits,
} from "./transferTerms";

const providers = [
  { code: "MPESA", name: "M-Pesa", enabled: true, min_amount: "100", max_amount: "150000", currency: "KES" },
  { code: "AIRTEL", name: "Airtel Money", enabled: true, min_amount: 50, max_amount: 70000 },
  { code: "KCB", name: "KCB Bank", enabled: true },
];

describe("providerLimits", () => {
  it("uses the chosen provider's published limits", () => {
    expect(providerLimits(providers, "M-Pesa", "KES")).toEqual({ min: 100, max: 150000, currency: "KES" });
    expect(providerLimits(providers, "airtel", "KES")).toEqual({ min: 50, max: 70000, currency: "KES" });
  });

  it("falls back to the widest range across providers when none is chosen", () => {
    expect(providerLimits(providers, "", "KES")).toEqual({ min: 50, max: 150000, currency: "KES" });
  });

  it("never merges bounds published in different currencies", () => {
    const mixed = [
      { code: "A", name: "A", enabled: true, min_amount: 100, max_amount: 1000, currency: "KES" },
      { code: "B", name: "B", enabled: true, min_amount: 5, max_amount: 50, currency: "USD" },
    ];
    expect(providerLimits(mixed, "", "KES")).toBeNull();
    expect(providerLimits(mixed, "stale-name", "KES")).toBeNull();
    expect(providerLimits(mixed, "B", "KES")).toEqual({ min: 5, max: 50, currency: "USD" });
  });

  it("returns null when the catalog publishes no limits — never a guess", () => {
    expect(providerLimits([providers[2]], "KCB Bank", "KES")).toBeNull();
    expect(providerLimits(null, "", "KES")).toBeNull();
  });

  it("ignores junk values", () => {
    expect(
      providerLimits([{ code: "X", name: "X", enabled: true, min_amount: "abc", max_amount: 0 }], "X", "KES"),
    ).toBeNull();
  });
});

describe("formatLimitsLine / limitViolation", () => {
  const limits = { min: 100, max: 150000, currency: "KES" };

  it("formats either side", () => {
    expect(formatLimitsLine(limits)).toBe("Min KES 100 · Max KES 150,000");
    expect(formatLimitsLine({ ...limits, min: null })).toBe("Max KES 150,000");
    expect(formatLimitsLine(null)).toBeNull();
  });

  it("flags amounts outside the range only", () => {
    expect(limitViolation("", limits)).toBeNull();
    expect(limitViolation("5000", limits)).toBeNull();
    expect(limitViolation("50", limits)).toBe("Minimum is KES 100 per transaction.");
    expect(limitViolation("200,000", limits)).toMatch(/^Maximum is KES 150,000 per transaction/);
    expect(limitViolation("50", null)).toBeNull();
  });
});

describe("formatCountdown", () => {
  const now = Date.parse("2026-10-14T12:00:00Z");
  it("counts down to the quote expiry", () => {
    expect(formatCountdown("2026-10-14T12:04:05Z", now)).toBe("4:05");
    expect(formatCountdown("2026-10-14T11:59:00Z", now)).toBe("0:00");
    expect(formatCountdown(null, now)).toBeNull();
    expect(formatCountdown("not a date", now)).toBeNull();
  });
});

describe("bankInstructionsText", () => {
  it("leads with the exact amount and lists every detail", () => {
    expect(
      bankInstructionsText({
        amount: "5,000",
        currency: "KES",
        rows: [
          { k: "Account number", v: "0100234567" },
          { k: "Reference", v: "MBK-7Q4K2" },
        ],
        arrival: "Within minutes",
      }),
    ).toBe("Pay exactly 5,000 KES\nAccount number: 0100234567\nReference: MBK-7Q4K2\nArrival: Within minutes");
  });
});
