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
  ensureSelectedProvider,
  indexOfProviderName,
  resolveQuotedProviderName,
} from "./depositFlowHelpers";

describe("buildDepositDestinationSummary", () => {
  it("describes a stablecoin top-up", () => {
    expect(
      buildDepositDestinationSummary({
        depositGroup: "crypto",
        depositAsset: "usdc",
        depositNetworkLabel: "Base",
        countryName: "Kenya",
        channelLabel: "Mobile money",
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
        channelLabel: "Mobile money",
      }),
    ).toBe("Kenya · Mobile money");
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

describe("provider identity across catalog updates", () => {
  it("keeps the selected name when the catalog reorders the list", () => {
    const before = ["KCB Bank", "Equity Bank", "Prime Bank"];
    const selected = resolveQuotedProviderName(before, "Prime Bank");
    const after = ["Prime Bank", "Equity Bank"];
    expect(indexOfProviderName(before, selected)).toBe(2);
    expect(indexOfProviderName(after, selected)).toBe(0);
    expect(resolveQuotedProviderName(after, selected)).toBe("Prime Bank");
    expect(after[Math.min(2, after.length - 1)]).toBe("Equity Bank");
  });

  it("keeps a selected provider that the catalog dropped", () => {
    const after = ["Equity Bank", "NCBA Bank"];
    expect(ensureSelectedProvider(after, "Prime Bank")[0]).toBe("Prime Bank");
    expect(resolveQuotedProviderName(after, "Prime Bank")).toBe("Prime Bank");
  });
});
