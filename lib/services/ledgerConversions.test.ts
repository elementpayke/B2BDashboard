import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/apiClient", () => ({
  apiEnvelope: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

import {
  ledgerPreviewToConversionOut,
  ledgerResultToConversionOut,
  ledgerConversionsApi,
} from "@/lib/services/ledgerConversions";

describe("ledgerPreviewToConversionOut", () => {
  it("maps Aggregator preview fields into ConversionOut", () => {
    const out = ledgerPreviewToConversionOut(
      {
        preview_token: "ep_fx_prev_abc123456",
        from_account_id: 10,
        to_account_id: 22,
        from_currency: "EUR",
        to_currency: "USD",
        amount_from: "10.00",
        amount_to: "11.20",
        rate: 1.12,
        fee: "0.00",
        expires_at: "2026-09-15T11:05:13+00:00",
      },
      { sourceAccountId: "10", destinationAccountId: "22" },
    );
    expect(out.quote_id).toBe("ep_fx_prev_abc123456");
    expect(out.source_currency).toBe("EUR");
    expect(out.destination_currency).toBe("USD");
    expect(out.destination_amount).toBe("11.20");
    expect(out.direction).toBe("ledger_fx");
  });
});

describe("ledgerResultToConversionOut", () => {
  it("keeps quote fallbacks when confirm omits amounts", () => {
    const quoted = ledgerPreviewToConversionOut(
      {
        preview_token: "ep_fx_prev_abc123456",
        from_currency: "EUR",
        to_currency: "GBP",
        amount_from: "5.00",
        amount_to: "4.20",
      },
      { sourceAccountId: "1", destinationAccountId: "2" },
    );
    const done = ledgerResultToConversionOut({ id: "fx1", status: "completed" }, quoted);
    expect(done.id).toBe("fx1");
    expect(done.status).toBe("completed");
    expect(done.destination_amount).toBe("4.20");
  });
});

describe("ledgerConversionsApi.confirm idempotency", () => {
  it("derives a stable key from the preview token by default", async () => {
    const { apiEnvelope } = await import("@/lib/apiClient");
    const mocked = vi.mocked(apiEnvelope);
    mocked.mockResolvedValue({} as never);

    await ledgerConversionsApi.confirm("ent", "10", {
      preview_token: "ep_fx_prev_tokenvalue",
    });

    const opts = mocked.mock.calls[0]?.[3] as {
      headers?: Record<string, string>;
    };
    expect(opts.headers?.["Idempotency-Key"]).toBe(
      "ledger-fx:ep_fx_prev_tokenvalue".slice(0, 64),
    );
  });
});
