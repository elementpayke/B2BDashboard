import { describe, expect, it } from "vitest";
import { isConvertMode, normalizeConvertMode } from "./ConvertFlow";

describe("convert mode validation", () => {
  it("accepts the supported conversion modes", () => {
    expect(isConvertMode("fiat_to_stable")).toBe(true);
    expect(isConvertMode("stable_to_fiat")).toBe(true);
    expect(isConvertMode("fiat_to_fiat")).toBe(true);
    expect(isConvertMode("stable_to_stable")).toBe(true);
  });

  it("falls back to fiat_to_stable for unknown values", () => {
    expect(isConvertMode("swap")).toBe(false);
    expect(normalizeConvertMode("swap")).toBe("fiat_to_stable");
    expect(normalizeConvertMode(null)).toBe("fiat_to_stable");
  });
});
