import { describe, expect, it } from "vitest";
import {
  buildUsdcSendDestChains,
  parseCollectSupportedChainKeys,
} from "./sendDestChains";

describe("parseCollectSupportedChainKeys", () => {
  it("reads chains[].chain from Aggregator shape", () => {
    expect(
      parseCollectSupportedChainKeys({
        chains: [
          { chain: "base", enabled: true },
          { chain: "polygon", enabled: false },
        ],
      }),
    ).toEqual(["base", "polygon"]);
  });

  it("returns empty for unknown payloads", () => {
    expect(parseCollectSupportedChainKeys(null)).toEqual([]);
    expect(parseCollectSupportedChainKeys({})).toEqual([]);
  });
});

describe("buildUsdcSendDestChains", () => {
  it("uses full catalog when supported list is empty", () => {
    const keys = buildUsdcSendDestChains().map((c) => c.key);
    expect(keys).toContain("base");
    expect(keys).toContain("stellar");
    expect(keys).toContain("ethereum");
    expect(keys).toContain("arc");
  });

  it("includes Arc when the aggregator reports it as a supported chain", () => {
    expect(
      buildUsdcSendDestChains({ supportedChainKeys: ["arc"] }),
    ).toEqual([
      { key: "arc", label: "Arc" },
      { key: "stellar", label: "Stellar" },
    ]);
  });

  it("intersects catalog with supported keys and always appends Stellar", () => {
    expect(
      buildUsdcSendDestChains({ supportedChainKeys: ["base", "optimism"] }).map(
        (c) => c.key,
      ),
    ).toEqual(["base", "optimism", "stellar"]);
  });

  it("never exposes CCTP in labels", () => {
    for (const row of buildUsdcSendDestChains()) {
      expect(row.label.toLowerCase()).not.toContain("cctp");
    }
  });
});
