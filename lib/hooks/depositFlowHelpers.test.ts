import { describe, expect, it } from "vitest";
import { COUNTRIES } from "@/components/mockData";
import {
  BANK_SEARCH_THRESHOLD,
  buildDepositDestinationSummary,
  buildDepositStepDots,
  countryMatchesQuery,
  countryRailsLabel,
  countrySearchHaystack,
  filterProvidersWithPinnedSelection,
} from "./depositFlowHelpers";

describe("buildDepositDestinationSummary", () => {
  it("describes a stablecoin top-up", () => {
    expect(
      buildDepositDestinationSummary({
        depositGroup: "crypto",
        depositAsset: "usdc",
        depositNetworkLabel: "Base",
        countryName: "Kenya",
        providerName: "M-Pesa",
      }),
    ).toBe("USDC · Base");
  });

  it("describes a fiat corridor top-up", () => {
    expect(
      buildDepositDestinationSummary({
        depositGroup: "country",
        depositAsset: "usdc",
        depositNetworkLabel: "Base",
        countryName: "Kenya",
        providerName: "M-Pesa",
      }),
    ).toBe("Kenya · M-Pesa");
  });
});

describe("buildDepositStepDots", () => {
  it("marks completed steps", () => {
    expect(buildDepositStepDots(2, 3)).toEqual([{ on: true }, { on: true }, { on: false }]);
  });
});

describe("country search", () => {
  it("matches provider names such as mtn across Uganda and Ghana", () => {
    const hits = COUNTRIES.filter((c) =>
      countryMatchesQuery(countrySearchHaystack(c), "mtn"),
    ).map((c) => c.name);
    expect(hits).toEqual(["Uganda", "Ghana"]);
  });

  it("matches currency codes", () => {
    const hits = COUNTRIES.filter((c) =>
      countryMatchesQuery(countrySearchHaystack(c), "kes"),
    ).map((c) => c.code);
    expect(hits).toEqual(["KES"]);
  });

  it("summarises available rails", () => {
    const kenya = COUNTRIES.find((c) => c.code === "KES")!;
    const za = COUNTRIES.find((c) => c.code === "ZAR")!;
    expect(countryRailsLabel(kenya)).toBe("Mobile money · Bank transfer");
    expect(countryRailsLabel(za)).toBe("Bank transfer");
  });
});

describe("filterProvidersWithPinnedSelection", () => {
  const kenyaBanks = COUNTRIES.find((c) => c.code === "KES")!.rails.find((r) => r.type === "bank")!
    .options;

  it("shows bank search once a country has more than six banks", () => {
    expect(kenyaBanks.length).toBeGreaterThan(BANK_SEARCH_THRESHOLD);
    const usBanks = COUNTRIES.find((c) => c.code === "USD")!.rails.find((r) => r.type === "bank")!
      .options;
    expect(usBanks.length).toBeLessThanOrEqual(BANK_SEARCH_THRESHOLD);
  });

  it("pins a selected bank that the search would hide", () => {
    const primeIdx = kenyaBanks.findIndex((name) => name === "Prime Bank");
    const filtered = filterProvidersWithPinnedSelection(kenyaBanks, "equ", primeIdx);
    expect(filtered[0]).toEqual({ name: "Prime Bank", index: primeIdx, pinned: true });
    expect(filtered.some((item) => item.name === "Equity Bank")).toBe(true);
  });
});
