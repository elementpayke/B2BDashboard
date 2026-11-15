import { describe, expect, it } from "vitest";
import { isConvertMode, normalizeConvertMode } from "./ConvertFlow";

describe("convert mode validation", () => {
  it("accepts the supported conversion modes", () => {
    expect(isConvertMode("fiat_to_stable")).toBe(true);
    expect(isConvertMode("stable_to_fiat")).toBe(true);
    expect(isConvertMode("fiat_to_fiat")).toBe(true);
  });

  it("rejects the retired stable_to_stable mode", () => {
    // Removed from the UI: it only served Stellar swaps, which Mboka gates
    // behind STELLAR_SWAPS_ENABLED (default false), so the tab had no source
    // accounts to offer. A persisted value must not resurrect it.
    expect(isConvertMode("stable_to_stable")).toBe(false);
    expect(normalizeConvertMode("stable_to_stable")).toBe("fiat_to_stable");
  });

  it("falls back to fiat_to_stable for unknown values", () => {
    expect(isConvertMode("swap")).toBe(false);
    expect(normalizeConvertMode("swap")).toBe("fiat_to_stable");
    expect(normalizeConvertMode(null)).toBe("fiat_to_stable");
  });
});
