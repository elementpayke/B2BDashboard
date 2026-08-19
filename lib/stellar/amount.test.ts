import { describe, expect, it } from "vitest";
import { parseStellarAmount } from "./amount";

describe("parseStellarAmount", () => {
  it("normalizes whole amounts and trailing dots", () => {
    expect(parseStellarAmount("100")).toEqual({ ok: true, amount: "100", error: null });
    expect(parseStellarAmount("100.")).toEqual({ ok: true, amount: "100", error: null });
    expect(parseStellarAmount("01.2500")).toEqual({ ok: true, amount: "1.25", error: null });
  });

  it("rejects empty, zero, and too many decimals", () => {
    expect(parseStellarAmount("")).toMatchObject({ ok: false });
    expect(parseStellarAmount("0")).toMatchObject({ ok: false });
    expect(parseStellarAmount("1.12345678")).toMatchObject({ ok: false });
  });
});
