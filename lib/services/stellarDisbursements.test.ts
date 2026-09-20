import { describe, expect, it } from "vitest";
import { parseBulkStellarPayoutCsv } from "./stellarDisbursements";

describe("parseBulkStellarPayoutCsv", () => {
  it("parses headered CSV rows including quoted fields", () => {
    const rows = parseBulkStellarPayoutCsv(
      [
        "destination,amount,memo,reference",
        'GA123,25.50,"Payroll, Sept",ops-001',
        "GB456,10.00,,ops-002",
      ].join("\n"),
    );

    expect(rows).toEqual([
      {
        destination: "GA123",
        amount: "25.50",
        memo: "Payroll, Sept",
        reference: "ops-001",
      },
      {
        destination: "GB456",
        amount: "10.00",
        memo: null,
        reference: "ops-002",
      },
    ]);
  });

  it("accepts rows without a header", () => {
    expect(parseBulkStellarPayoutCsv("GA123,1.00\nGB456,2.00")).toEqual([
      { destination: "GA123", amount: "1.00", memo: null, reference: null },
      { destination: "GB456", amount: "2.00", memo: null, reference: null },
    ]);
  });

  it("rejects empty files and invalid rows", () => {
    expect(() => parseBulkStellarPayoutCsv("")).toThrow(/at least one payout row/i);
    expect(() => parseBulkStellarPayoutCsv("destination,amount\n,5.00")).toThrow(
      /missing a destination/i,
    );
    expect(() => parseBulkStellarPayoutCsv("destination,amount\nGA123,0.50")).toThrow(
      /minimum convert amount/i,
    );
  });
});
