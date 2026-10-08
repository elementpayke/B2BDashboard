import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/apiClient", () => ({
  apiEnvelope: vi.fn(),
}));

import {
  explainDisbursementFailure,
  normalizeBulkBatch,
  parseBulkStellarPayoutCsv,
  parseBulkStellarPayoutCsvLoose,
  stellarDisbursementsApi,
} from "./stellarDisbursements";

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

describe("parseBulkStellarPayoutCsvLoose", () => {
  it("parses valid rows the same way the strict parser does", () => {
    expect(parseBulkStellarPayoutCsvLoose("GA123,1.00\nGB456,2.00")).toEqual([
      { destination: "GA123", amount: "1.00", memo: null, reference: null },
      { destination: "GB456", amount: "2.00", memo: null, reference: null },
    ]);
  });

  it("keeps a row with a missing destination instead of throwing", () => {
    expect(parseBulkStellarPayoutCsvLoose("destination,amount\n,5.00")).toEqual([
      { destination: "", amount: "5.00", memo: null, reference: null },
    ]);
  });

  it("keeps a row with an invalid or below-minimum amount instead of throwing", () => {
    expect(parseBulkStellarPayoutCsvLoose("destination,amount\nGA123,0.50")).toEqual([
      { destination: "GA123", amount: "0.50", memo: null, reference: null },
    ]);
    expect(parseBulkStellarPayoutCsvLoose("destination,amount\nGA123,notanumber")).toEqual([
      { destination: "GA123", amount: "notanumber", memo: null, reference: null },
    ]);
  });

  it("still rejects input with nothing to edit", () => {
    expect(() => parseBulkStellarPayoutCsvLoose("")).toThrow(/at least one payout row/i);
    expect(() => parseBulkStellarPayoutCsvLoose("destination,amount")).toThrow(
      /at least one payout after the csv header/i,
    );
  });
});

describe("explainDisbursementFailure", () => {
  it("maps trustline failures to actionable copy", () => {
    expect(explainDisbursementFailure("destination_missing_trustline")).toMatch(/trustline/i);
  });

  it("humanizes unknown codes", () => {
    expect(explainDisbursementFailure("custom_code_x")).toMatch(/custom code x/i);
  });
});

describe("normalizeBulkBatch", () => {
  it("keeps failure_code / last_error as item.error for the result UI", () => {
    const batch = normalizeBulkBatch({
      batch_id: "3",
      status: "failed",
      items: [
        {
          destination_address: "GA123",
          amount: "2",
          status: "failed",
          last_error: "destination_missing_trustline",
        },
      ],
    });
    expect(batch.items[0].error).toBe("destination_missing_trustline");
    expect(batch.items[0].destination).toBe("GA123");
  });

  it("maps tx_hash / external_item_id for View onchain links", () => {
    const batch = normalizeBulkBatch({
      batch_id: "4",
      status: "completed",
      items: [
        {
          destination_address: "GA123",
          amount: "3",
          status: "completed",
          tx_hash: "abc123hash",
        },
        {
          destination: "GB456",
          amount: "2",
          status: "completed",
          external_item_id: "def456hash",
        },
      ],
    });
    expect(batch.items[0].tx_hash).toBe("abc123hash");
    expect(batch.items[1].tx_hash).toBe("def456hash");
  });
});

describe("stellarDisbursementsApi", () => {
  it("sends entity_id and account_id on preview, matching the backend's ownership contract", async () => {
    const { apiEnvelope } = await import("@/lib/apiClient");
    const mocked = vi.mocked(apiEnvelope);
    mocked.mockResolvedValue({
      preview_token: "tok_1",
      total_amount: "10.00",
      currency: "USDC",
      items: [],
    } as never);

    const rows = [{ destination: "GA123", amount: "10.00", memo: null, reference: null }];
    await stellarDisbursementsApi.preview("ent_1", "acct_1", rows);

    expect(mocked).toHaveBeenCalledWith("POST", "/v1/disbursements/stellar/preview", {
      entity_id: "ent_1",
      account_id: "acct_1",
      items: rows,
    });
  });

  it("sends entity_id and account_id on confirm alongside the preview token", async () => {
    const { apiEnvelope } = await import("@/lib/apiClient");
    const mocked = vi.mocked(apiEnvelope);
    mocked.mockResolvedValue({ batch_id: "b1", status: "processing", items: [] } as never);

    await stellarDisbursementsApi.confirm("ent_1", "acct_1", "tok_1");

    expect(mocked).toHaveBeenCalledWith("POST", "/v1/disbursements/stellar/confirm", {
      entity_id: "ent_1",
      account_id: "acct_1",
      preview_token: "tok_1",
    });
  });
});
