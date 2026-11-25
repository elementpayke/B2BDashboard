import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/apiClient", () => {
  class ApiRequestError extends Error {
    status: number;
    data: unknown;
    constructor(message: string, status: number, data: unknown = null) {
      super(message);
      this.status = status;
      this.data = data;
    }
  }
  return { apiEnvelope: vi.fn(), ApiRequestError };
});

beforeEach(() => {
  vi.clearAllMocks();
});

import { ApiRequestError } from "@/lib/apiClient";
import {
  describeLedgerConversionError,
  isTerminalConversionStatus,
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

describe("bridged previews", () => {
  const bridged = ledgerPreviewToConversionOut(
    {
      route: "bridged",
      preview_token: "ep_fx_prev_bridged1",
      from_currency: "USDC",
      to_currency: "USD",
      amount_from: "2.00",
      amount_to: "2.07",
      rate: 1.035,
      rate_locked: false,
      amount_to_status: "estimated",
      fee: null,
      fee_status: "estimated",
      notice: "This conversion moves USDC on-chain and takes a few minutes.",
      stages: ["pending", "processing_onchain", "processing_to_fiat", "completed"],
    },
    { sourceAccountId: "ep_stellar:1", destinationAccountId: "22" },
  );

  it("carries route, estimate flags, notice and stages", () => {
    expect(bridged.route).toBe("bridged");
    expect(bridged.rate_locked).toBe(false);
    expect(bridged.destination_amount_estimated).toBe(true);
    expect(bridged.fee_status).toBe("estimated");
    expect(bridged.notice).toContain("few minutes");
    expect(bridged.stages).toHaveLength(4);
  });

  it("treats a preview with no rate_locked field as locked", () => {
    const old = ledgerPreviewToConversionOut(
      { preview_token: "t", from_currency: "EUR", to_currency: "USD" },
      { sourceAccountId: "1", destinationAccountId: "2" },
    );
    expect(old.rate_locked).toBe(true);
    expect(old.destination_amount_estimated).toBe(false);
  });

  it("maps a job and drops the estimate flag once completed", () => {
    const job = ledgerResultToConversionOut(
      { id: "cvj_42", route: "bridged", status: "processing_onchain", stage: "USDC is crossing chains." },
      bridged,
    );
    expect(job.id).toBe("cvj_42");
    expect(job.stage).toContain("crossing");
    expect(job.destination_amount_estimated).toBe(true);
    expect(isTerminalConversionStatus(job.status)).toBe(false);

    const done = ledgerResultToConversionOut(
      { id: "cvj_42", status: "completed", amount_to: "2.05" },
      job,
    );
    expect(done.destination_amount).toBe("2.05");
    expect(done.destination_amount_estimated).toBe(false);
    expect(isTerminalConversionStatus(done.status)).toBe(true);
  });

  it("polls the entity-scoped status path", async () => {
    const { apiEnvelope } = await import("@/lib/apiClient");
    vi.mocked(apiEnvelope).mockResolvedValue({} as never);
    await ledgerConversionsApi.get("ent", "ep_stellar:1", "cvj_42");
    expect(vi.mocked(apiEnvelope).mock.calls[0]?.slice(0, 2)).toEqual([
      "GET",
      "/v1/entities/ent/accounts/ep_stellar%3A1/conversions/cvj_42",
    ]);
  });
});

describe("describeLedgerConversionError", () => {
  it("renders the backend's supported list rather than a hard-coded one", () => {
    const err = new ApiRequestError("Source account currency is not supported for conversion", 422, {
      field: "account_id",
      currency: "KES",
      supported: ["AED", "EUR", "USD", "USDC"],
    });
    expect(describeLedgerConversionError(err, "x")).toBe(
      "KES can't be converted yet — conversions are available for AED, EUR, USD and USDC.",
    );
  });

  it("shows the available balance from an insufficient_balance 422", () => {
    const err = new ApiRequestError("Insufficient balance", 422, {
      code: "insufficient_balance",
      available: "10.00",
      required: "10.05",
      currency: "usd",
    });
    const msg = describeLedgerConversionError(err, "x");
    expect(msg).toContain("10.00 USD available");
    expect(msg).toContain("10.05 USD needed");
  });

  it("reads data Mboka nests under upstream for pass-through statuses", () => {
    const err = new ApiRequestError("Bridge account pending", 409, {
      upstream: { message: "Bridge account pending", data: { code: "bridge_account_pending" } },
    });
    expect(describeLedgerConversionError(err, "x")).toContain("Try again in a minute");
  });

  it("finds insufficient_balance under upstream too", () => {
    const err = new ApiRequestError("Insufficient balance", 422, {
      upstream: {
        data: { code: "insufficient_balance", available: "1.00", currency: "USDC" },
      },
    });
    expect(describeLedgerConversionError(err, "x")).toContain("1.00 USDC available");
  });

  it("explains a 503 as the bridge being switched off", () => {
    const err = new ApiRequestError("", 503, null);
    expect(describeLedgerConversionError(err, "x")).toContain("isn't switched on");
  });

  it("falls back to the message, then the default", () => {
    expect(describeLedgerConversionError(new Error("boom"), "x")).toBe("boom");
    expect(describeLedgerConversionError(null, "fallback")).toBe("fallback");
  });
});
