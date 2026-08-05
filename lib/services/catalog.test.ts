import { describe, it, expect } from "vitest";
import {
  offRampProvidersForRail,
  networkIdForProvider,
  type SupportedCatalogData,
} from "./catalog";

const CATALOG: SupportedCatalogData = {
  disclaimer: "Indicative catalog.",
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
    },
  },
};

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
