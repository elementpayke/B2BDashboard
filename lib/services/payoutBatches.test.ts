import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/apiClient", () => {
  class ApiRequestError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.name = "ApiRequestError";
      this.status = status;
    }
  }
  return { apiEnvelope: vi.fn(), ApiRequestError };
});

import {
  explainPayoutFailure,
  hasResolvableNetworkAlias,
  matchMomoProviderForNetwork,
  normalizeMixedBatch,
  parseMixedPayoutCsvLoose,
  preparePayoutRowsForPreview,
  payoutMethodLabel,
  railLabel,
  resolvePayoutRail,
  samplePayoutCsv,
  ONE_DESTINATION_PER_ROW,
  PHONE_NETWORK_REQUIRED,
} from "./payoutBatches";
import type { SupportedCatalogData } from "./catalog";

describe("resolvePayoutRail", () => {
  it("resolves stellar from destination", () => {
    expect(
      resolvePayoutRail({
        destination: "GA123",
        amount: "5",
        currency: "USDC",
      }),
    ).toEqual({ rail: "stellar", error: null });
  });

  it("resolves mobile money from phone + country + name + network", () => {
    expect(
      resolvePayoutRail({
        phone: "+254711111111",
        country: "KE",
        recipient_name: "Jane",
        network: "mpesa",
        amount: "1500",
        currency: "KES",
      }),
    ).toEqual({ rail: "mobile_money", error: null });
  });

  it("requires network on phone rows", () => {
    expect(
      resolvePayoutRail({
        phone: "+254711111111",
        country: "KE",
        recipient_name: "Jane",
        amount: "1500",
        currency: "KES",
      }).error,
    ).toBe(PHONE_NETWORK_REQUIRED);
  });

  it("rejects zero and multi-destination rows", () => {
    expect(resolvePayoutRail({ amount: "1", currency: "USDC" }).error).toMatch(
      /wallet address, phone number, or bank/,
    );
    expect(
      resolvePayoutRail({
        destination: "GA123",
        phone: "+254711111111",
        amount: "1",
        currency: "USDC",
      }).error,
    ).toBe(ONE_DESTINATION_PER_ROW);
  });

  it("resolves bank from account + country + name + network", () => {
    expect(
      resolvePayoutRail({
        bank_account_number: "0123456789",
        country: "KE",
        recipient_name: "Grace",
        network: "Equity Bank",
        amount: "2200",
        currency: "KES",
      }),
    ).toEqual({ rail: "bank", error: null });
  });
});

describe("parseMixedPayoutCsvLoose", () => {
  it("parses the legacy 10-column headered CSV", () => {
    const rows = parseMixedPayoutCsvLoose(
      [
        "destination,phone,bank_account_number,bank_code,country,amount,currency,recipient_name,memo,reference",
        "GA123,,,,,5.00,USDC,,,ref-1",
        ",+254711111111,,,KE,1500,KES,Jane,,ref-2",
      ].join("\n"),
    );
    expect(rows).toHaveLength(2);
    expect(rows[0].destination).toBe("GA123");
    expect(rows[0].amount).toBe("5.00");
    expect(rows[1].phone).toBe("+254711111111");
    expect(rows[1].currency).toBe("KES");
    expect(resolvePayoutRail(rows[0]).rail).toBe("stellar");
    expect(resolvePayoutRail({ ...rows[1], network: "mpesa" }).rail).toBe("mobile_money");
  });

  it("parses wallets-only and multi-country mixed samples", () => {
    const walletRows = parseMixedPayoutCsvLoose(samplePayoutCsv("wallets"));
    expect(walletRows).toHaveLength(2);
    expect(walletRows[0].destination).toMatch(/^G/);
    expect(walletRows[0].phone).toBeNull();

    const mixedRows = parseMixedPayoutCsvLoose(samplePayoutCsv("wallets_and_phones"));
    expect(mixedRows.length).toBeGreaterThanOrEqual(9);
    expect(resolvePayoutRail(mixedRows[0]).rail).toBe("stellar");
    expect(mixedRows[1].network).toBe("mpesa");
    expect(resolvePayoutRail(mixedRows[1]).rail).toBe("mobile_money");
    expect(resolvePayoutRail(mixedRows[2]).rail).toBe("bank");
    expect(mixedRows[2].bank_account_number).toBe("1111111111");
    expect(mixedRows.map((r) => r.country).filter(Boolean)).toEqual(
      expect.arrayContaining(["KE", "NG", "GH", "UG", "TZ"]),
    );
    // All fiat phones/banks use YC sandbox magic numbers (not live-looking MSISDNs).
    for (const row of mixedRows) {
      if (row.phone) {
        expect(row.phone).toMatch(/^\+\d+(1111111111|0000000000)$/);
      }
      if (row.bank_account_number) {
        expect(["1111111111", "0000000000"]).toContain(row.bank_account_number);
      }
    }
    const failMomo = mixedRows.find((r) => r.reference === "EP-FAIL-MOMO");
    const failBank = mixedRows.find((r) => r.reference === "EP-FAIL-BANK");
    expect(failMomo?.phone).toBe("+2540000000000");
    expect(resolvePayoutRail(failMomo!).rail).toBe("mobile_money");
    expect(failBank?.bank_account_number).toBe("0000000000");
    expect(resolvePayoutRail(failBank!).rail).toBe("bank");
  });

  it("parses network / provider header aliases", () => {
    const rows = parseMixedPayoutCsvLoose(
      [
        "phone,country,provider,amount,currency,recipient_name",
        "+254722222222,KE,airtel,100,KES,Sam",
      ].join("\n"),
    );
    expect(rows[0].network).toBe("airtel");
    expect(payoutMethodLabel("mobile_money", rows[0].network)).toBe("Airtel Money");
  });
});

describe("hasResolvableNetworkAlias", () => {
  it("accepts sample aliases without a live catalog match", () => {
    expect(
      hasResolvableNetworkAlias("mobile_money", { network: "opay" }),
    ).toBe(true);
    expect(
      hasResolvableNetworkAlias("mobile_money", { network: "mtn" }),
    ).toBe(true);
    expect(
      hasResolvableNetworkAlias("bank", { network: "GTBank" }),
    ).toBe(true);
    expect(hasResolvableNetworkAlias("mobile_money", { network: "" })).toBe(false);
  });
});

describe("preparePayoutRowsForPreview", () => {
  it("mirrors network into bank_code for bank rows", () => {
    const [row] = preparePayoutRowsForPreview([
      {
        bank_account_number: "1111111111",
        country: "KE",
        network: "Equity Bank",
        recipient_name: "Grace",
        amount: "100",
        currency: "KES",
      },
    ]);
    expect(row.bank_code).toBe("Equity Bank");
    expect(row.network).toBe("Equity Bank");
  });
});

describe("matchMomoProviderForNetwork", () => {
  const catalog: SupportedCatalogData = {
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
              label: "Mobile money",
              quote_type: "mobile_money",
              providers: [
                { id: "uuid-mpesa", code: "MPESAKE", name: "M-PESA", enabled: true },
                { id: "uuid-airtel", code: "AIRTELKE", name: "Airtel Money", enabled: true },
              ],
            },
          },
        },
      },
    },
  };

  it("matches aliases without falling back to first provider", () => {
    expect(matchMomoProviderForNetwork(catalog, "KE", "airtel")?.id).toBe("uuid-airtel");
    expect(matchMomoProviderForNetwork(catalog, "KE", "mpesa")?.id).toBe("uuid-mpesa");
    expect(matchMomoProviderForNetwork(catalog, "KE", "unknown-net")).toBeNull();
  });
});

describe("normalizeMixedBatch", () => {
  it("maps Mboka payout batch payloads", () => {
    const batch = normalizeMixedBatch({
      id: 42,
      status: "partially_failed",
      total_items: 2,
      stellar_item_count: 1,
      fiat_item_count: 1,
      items: [
        {
          id: 1,
          row_index: 1,
          rail: "stellar",
          recipient_label: "GA123",
          amount: "5.00",
          currency: "USDC",
          status: "completed",
          tx_hash: "abc",
        },
        {
          id: 2,
          row_index: 2,
          rail: "mobile_money",
          recipient_label: "+254711111111",
          amount: "1500",
          currency: "KES",
          status: "failed",
          failure_code: "quote_expired",
        },
      ],
    });
    expect(batch.batch_id).toBe("42");
    expect(batch.stellar_item_count).toBe(1);
    expect(batch.items[1].rail).toBe("mobile_money");
  });
});

describe("explainPayoutFailure", () => {
  it("prefers fiat copy for mobile money codes", () => {
    expect(explainPayoutFailure("quote_expired", "mobile_money")).toMatch(/expired/i);
    expect(railLabel("mobile_money")).toBe("Mobile money");
    expect(railLabel("stellar")).toBe("Wallet");
    expect(payoutMethodLabel("mobile_money", "mpesa")).toBe("M-Pesa");
    expect(payoutMethodLabel("stellar")).toBe("Wallet");
  });
});
