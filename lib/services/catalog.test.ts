import { describe, it, expect } from "vitest";
import {
  offRampCountriesFromCatalog,
  offRampProvidersForRail,
  onRampCountriesFromCatalog,
  onRampProvidersForRail,
  networkIdForProvider,
  providerNamesFromCatalog,
  supportedCurrenciesFromCatalog,
  type SupportedCatalogData,
} from "./catalog";

const CATALOG: SupportedCatalogData = {
  disclaimer: "Indicative catalog.",
  onramp: {
    countries: {
      KE: {
        country_code: "KE",
        country_name: "Kenya",
        currency: "KES",
        enabled: true,
        payment_methods: {
          mobile_money: {
            enabled: true,
            label: "Mobile Money",
            quote_type: "mobile_money",
            providers: [
              { code: "M PESA", name: "Mobile Wallet (M-PESA)", enabled: true, id: "yc-mpesa-on-id" },
            ],
          },
        },
      },
    },
  },
  offramp: {
    countries: {
      KE: {
        country_code: "KE",
        country_name: "Kenya",
        currency: "KES",
        enabled: true,
        payment_methods: {
          mobile_money: {
            enabled: true,
            label: "Mobile Money",
            quote_type: "mobile_money",
            providers: [
              { code: "M PESA", name: "Mobile Wallet (M-PESA)", enabled: true, id: "yc-mpesa-id" },
              { code: "AIRTEL", name: "Airtel Money", enabled: false, id: "yc-airtel-id" },
            ],
          },
          bank: {
            enabled: true,
            label: "Bank Transfer",
            quote_type: "bank",
            providers: [{ code: "KCB", name: "KCB Bank", enabled: true, id: "yc-kcb-id" }],
          },
        },
      },
      NG: {
        country_code: "NG",
        country_name: "Nigeria",
        currency: "NGN",
        enabled: false,
        payment_methods: {
          bank: {
            enabled: true,
            label: "Bank Transfer",
            quote_type: "bank",
            providers: [{ code: "GTB", name: "GTBank", enabled: true, id: "yc-gtb-id" }],
          },
        },
      },
    },
  },
  international_bank: {
    currencies: {
      EUR: {
        currency: "EUR",
        label: "Euro",
        onramp: true,
        offramp: true,
        payment_methods: {
          bank: {
            enabled: true,
            label: "SEPA Transfer",
            quote_type: "bank",
            providers: [{ code: "SEPA", name: "SEPA Transfer", enabled: true, id: "sepa-id" }],
          },
        },
      },
      USD: {
        currency: "USD",
        label: "US Dollar",
        onramp: true,
        offramp: false,
        payment_methods: {
          bank: {
            enabled: true,
            label: "Wire",
            quote_type: "bank",
            providers: [{ code: "WIRE", name: "US Wire", enabled: true, id: "wire-id" }],
          },
        },
      },
      GBP: {
        currency: "GBP",
        label: "Pound Sterling",
        onramp: false,
        offramp: true,
        payment_methods: {
          bank: {
            enabled: true,
            label: "Faster Payments",
            quote_type: "bank",
            providers: [{ code: "FPS", name: "Faster Payments", enabled: true, id: "fps-id" }],
          },
        },
      },
    },
  },
};

describe("supportedCurrenciesFromCatalog", () => {
  it("collects currencies from enabled onramp/offramp countries and intl bank", () => {
    expect(supportedCurrenciesFromCatalog(CATALOG).sort()).toEqual(
      ["EUR", "GBP", "KES", "USD"].sort(),
    );
  });

  it("skips disabled countries and intl currencies with neither ramp", () => {
    const codes = supportedCurrenciesFromCatalog(CATALOG);
    expect(codes).not.toContain("NGN");
  });

  it("returns empty when the catalog is missing", () => {
    expect(supportedCurrenciesFromCatalog(null)).toEqual([]);
    expect(supportedCurrenciesFromCatalog(undefined)).toEqual([]);
  });
});

describe("offRampProvidersForRail", () => {
  it("returns enabled providers for a known country + rail", () => {
    const providers = offRampProvidersForRail(CATALOG, "ke", "mobile", "KES");
    expect(providers).toEqual([
      { code: "M PESA", name: "Mobile Wallet (M-PESA)", enabled: true, id: "yc-mpesa-id" },
    ]);
  });

  it("filters out disabled providers", () => {
    const providers = offRampProvidersForRail(CATALOG, "ke", "mobile", "KES");
    expect(providers?.some((p) => p.code === "AIRTEL")).toBe(false);
  });

  it("is case-insensitive on the country ISO code", () => {
    const providers = offRampProvidersForRail(CATALOG, "KE", "bank", "KES");
    expect(providers).toEqual([{ code: "KCB", name: "KCB Bank", enabled: true, id: "yc-kcb-id" }]);
  });

  it("falls back to international_bank currencies when the country entry is disabled", () => {
    const providers = offRampProvidersForRail(CATALOG, "ng", "bank", "NGN");
    expect(providers).toBeNull();
  });

  it("resolves cross-border bank currencies via international_bank", () => {
    const providers = offRampProvidersForRail(CATALOG, "de", "bank", "EUR");
    expect(providers).toEqual([{ code: "SEPA", name: "SEPA Transfer", enabled: true, id: "sepa-id" }]);
  });

  it("ignores an international_bank currency with offramp: false", () => {
    const providers = offRampProvidersForRail(CATALOG, "us", "bank", "USD");
    expect(providers).toBeNull();
  });

  it("returns null for an unrecognized rail type rather than guessing", () => {
    expect(offRampProvidersForRail(CATALOG, "ke", "crypto", "KES")).toBeNull();
  });

  it("returns null when the catalog hasn't loaded yet", () => {
    expect(offRampProvidersForRail(null, "ke", "mobile", "KES")).toBeNull();
    expect(offRampProvidersForRail(undefined, "ke", "mobile", "KES")).toBeNull();
  });

  it("returns null for a country the catalog doesn't mention at all", () => {
    expect(offRampProvidersForRail(CATALOG, "gh", "mobile", "GHS")).toBeNull();
  });
});

describe("onRampProvidersForRail", () => {
  it("returns enabled onramp providers for a known country + rail", () => {
    const providers = onRampProvidersForRail(CATALOG, "ke", "mobile", "KES");
    expect(providers).toEqual([
      { code: "M PESA", name: "Mobile Wallet (M-PESA)", enabled: true, id: "yc-mpesa-on-id" },
    ]);
  });

  it("resolves cross-border bank currencies via international_bank onramp flag", () => {
    const providers = onRampProvidersForRail(CATALOG, "de", "bank", "EUR");
    expect(providers).toEqual([{ code: "SEPA", name: "SEPA Transfer", enabled: true, id: "sepa-id" }]);
  });

  it("ignores an international_bank currency with onramp: false", () => {
    const providers = onRampProvidersForRail(CATALOG, "gb", "bank", "GBP");
    expect(providers).toBeNull();
  });

  it("returns null when the catalog hasn't loaded yet", () => {
    expect(onRampProvidersForRail(null, "ke", "mobile", "KES")).toBeNull();
  });
});

describe("networkIdForProvider", () => {
  const providers = [
    { code: "M PESA", name: "Mobile Wallet (M-PESA)", enabled: true, id: "yc-mpesa-id" },
  ];

  it("matches by exact display name", () => {
    expect(networkIdForProvider(providers, "Mobile Wallet (M-PESA)")).toBe("yc-mpesa-id");
  });

  it("matches by provider code, case-insensitively", () => {
    expect(networkIdForProvider(providers, "m pesa")).toBe("yc-mpesa-id");
  });

  it("returns undefined when nothing matches", () => {
    expect(networkIdForProvider(providers, "Airtel Money")).toBeUndefined();
  });

  it("returns undefined when there's no provider list", () => {
    expect(networkIdForProvider(null, "Mobile Wallet (M-PESA)")).toBeUndefined();
  });
});

describe("providerNamesFromCatalog", () => {
  const catalogProviders = [
    { code: "M PESA", name: "Mobile Wallet (M-PESA)", enabled: true, id: "yc-mpesa-id" },
  ];

  it("uses catalog names when providers are present", () => {
    expect(providerNamesFromCatalog(catalogProviders)).toEqual([
      "Mobile Wallet (M-PESA)",
    ]);
  });

  it("returns empty when catalog has no match (no hardcoded fallback)", () => {
    expect(providerNamesFromCatalog(null)).toEqual([]);
    expect(providerNamesFromCatalog([])).toEqual([]);
    expect(providerNamesFromCatalog(null, ["M-Pesa (Safaricom)"], true)).toEqual([]);
  });
});

describe("offRampCountriesFromCatalog / onRampCountriesFromCatalog", () => {
  it("builds offramp countries with only enabled methods that have providers", () => {
    const countries = offRampCountriesFromCatalog(CATALOG);
    expect(countries.map((c) => c.iso)).toEqual(["eu", "ke", "gb"]);
    const ke = countries.find((c) => c.iso === "ke")!;
    expect(ke.rails.map((r) => r.type)).toEqual(["mobile", "bank"]);
    expect(ke.rails[0].options).toEqual(["Mobile Wallet (M-PESA)"]);
    expect(ke.dialCode).toBe("254");
  });

  it("omits disabled countries and empty mobile methods", () => {
    const countries = offRampCountriesFromCatalog(CATALOG);
    expect(countries.find((c) => c.iso === "ng")).toBeUndefined();
  });

  it("builds onramp countries from onramp + intl onramp currencies", () => {
    const countries = onRampCountriesFromCatalog(CATALOG);
    expect(countries.map((c) => c.code).sort()).toEqual(["EUR", "KES", "USD"]);
  });

  it("returns empty when catalog is missing", () => {
    expect(offRampCountriesFromCatalog(null)).toEqual([]);
    expect(onRampCountriesFromCatalog(undefined)).toEqual([]);
  });
});
