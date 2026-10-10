import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/apiClient", () => {
  class ApiRequestError extends Error {
    status: number;
    data: unknown;
    constructor(message: string, status: number, data: unknown = null) {
      super(message);
      this.name = "ApiRequestError";
      this.status = status;
      this.data = data;
    }
  }
  return { apiEnvelope: vi.fn(), ApiRequestError };
});

import { ApiRequestError } from "@/lib/apiClient";
import {
  explainDisbursementFailure,
  isTransientDisbursementError,
  normalizeBulkBatch,
  parseBulkStellarPayoutCsv,
  parseBulkStellarPayoutCsvLoose,
  stellarDisbursementsApi,
  withTransientRetry,
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

describe("isTransientDisbursementError", () => {
  it("treats 504 / timeout copy as retryable", () => {
    expect(isTransientDisbursementError(new ApiRequestError("Upstream request timed out.", 504))).toBe(
      true,
    );
    expect(isTransientDisbursementError(new Error("Upstream request timed out. Please try again."))).toBe(
      true,
    );
    expect(isTransientDisbursementError(new ApiRequestError("Invalid rows", 422))).toBe(false);
  });
});

describe("withTransientRetry", () => {
  it("retries once on transient failure then succeeds", async () => {
    let calls = 0;
    const result = await withTransientRetry(
      async () => {
        calls += 1;
        if (calls === 1) throw new ApiRequestError("Upstream request timed out.", 504);
        return "ok";
      },
      { retries: 1, delayMs: 1 },
    );
    expect(result).toBe("ok");
    expect(calls).toBe(2);
  });

  it("does not retry validation errors", async () => {
    let calls = 0;
    await expect(
      withTransientRetry(
        async () => {
          calls += 1;
          throw new ApiRequestError("bad", 422);
        },
        { retries: 2, delayMs: 1 },
      ),
    ).rejects.toMatchObject({ status: 422 });
    expect(calls).toBe(1);
  });
});

describe("stellarDisbursementsApi", () => {
  it("sends entity_id, account_id, and idempotency_key on preview", async () => {
    const { apiEnvelope } = await import("@/lib/apiClient");
    const mocked = vi.mocked(apiEnvelope);
    mocked.mockResolvedValue({
      preview_token: "tok_1",
      total_amount: "10.00",
      currency: "USDC",
      items: [],
    } as never);

    const rows = [{ destination: "GA123", amount: "10.00", memo: null, reference: null }];
    await stellarDisbursementsApi.preview("ent_1", "acct_1", rows, {
      idempotencyKey: "bulk-abc",
    });

    expect(mocked).toHaveBeenCalledWith("POST", "/v1/disbursements/stellar/preview", {
      entity_id: "ent_1",
      account_id: "acct_1",
      items: rows,
      idempotency_key: "bulk-abc",
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

  it("loads a batch by entity/account/batch id", async () => {
    const { apiEnvelope } = await import("@/lib/apiClient");
    const mocked = vi.mocked(apiEnvelope);
    mocked.mockResolvedValue({
      id: "batch_9",
      status: "completed",
      items: [
        {
          destination_address: "GA123",
          amount: "2.00",
          status: "completed",
          tx_hash: "hash_abc",
        },
      ],
    } as never);

    const batch = await stellarDisbursementsApi.getBatch("ent_1", "acct_1", "batch_9");

    expect(mocked).toHaveBeenCalledWith(
      "GET",
      "/v1/entities/ent_1/accounts/acct_1/disbursements/batch_9",
    );
    expect(batch.batch_id).toBe("batch_9");
    expect(batch.items[0].tx_hash).toBe("hash_abc");
  });

  it("lists batches for an entity/account", async () => {
    const { apiEnvelope } = await import("@/lib/apiClient");
    const mocked = vi.mocked(apiEnvelope);
    mocked.mockResolvedValue({
      batches: [
        { id: "batch_1", status: "completed", total_items: 2, items: [] },
        { id: "batch_2", status: "processing", total_items: 1, items: [] },
      ],
    } as never);

    const batches = await stellarDisbursementsApi.listBatches("ent_1", "acct_1");

    expect(mocked).toHaveBeenCalledWith(
      "GET",
      "/v1/entities/ent_1/accounts/acct_1/disbursements?limit=50",
    );
    expect(batches).toHaveLength(2);
    expect(batches[0].batch_id).toBe("batch_1");
    expect(batches[1].status).toBe("processing");
  });

  it("posts to the reconcile endpoint and surfaces the report alongside the batch", async () => {
    const { apiEnvelope } = await import("@/lib/apiClient");
    const mocked = vi.mocked(apiEnvelope);
    mocked.mockResolvedValue({
      id: "batch_9",
      status: "partially_failed",
      items: [],
      reconciliation: {
        items_checked: 2,
        items_matched: 1,
        items_corrected: [
          {
            partner_item_ref: "item-1",
            tx_hash: "hash_abc",
            previous_status: "processing",
            corrected_status: "failed",
          },
        ],
        items_unverifiable: [],
        drift_found: true,
      },
    } as never);

    const result = await stellarDisbursementsApi.reconcileBatch("ent_1", "acct_1", "batch_9");

    expect(mocked).toHaveBeenCalledWith(
      "POST",
      "/v1/entities/ent_1/accounts/acct_1/disbursements/batch_9/reconcile",
    );
    expect(result.batch.status).toBe("partially_failed");
    expect(result.reconciliation.drift_found).toBe(true);
    expect(result.reconciliation.items_corrected[0].corrected_status).toBe("failed");
  });
});
