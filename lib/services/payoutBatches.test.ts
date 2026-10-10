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
  normalizeMixedBatch,
  parseMixedPayoutCsvLoose,
  railLabel,
  resolvePayoutRail,
} from "./payoutBatches";

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

  it("resolves mobile money from phone + country + name", () => {
    expect(
      resolvePayoutRail({
        phone: "+254711111111",
        country: "KE",
        recipient_name: "Jane",
        amount: "1500",
        currency: "KES",
      }),
    ).toEqual({ rail: "mobile_money", error: null });
  });

  it("rejects zero and multi-rail rows", () => {
    expect(resolvePayoutRail({ amount: "1", currency: "USDC" }).error).toMatch(/Fill destination/);
    expect(
      resolvePayoutRail({
        destination: "GA123",
        phone: "+254711111111",
        amount: "1",
        currency: "USDC",
      }).error,
    ).toMatch(/exactly one/);
  });
});

describe("parseMixedPayoutCsvLoose", () => {
  it("parses the 10-column headered CSV", () => {
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
    expect(resolvePayoutRail(rows[1]).rail).toBe("mobile_money");
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
  });
});
