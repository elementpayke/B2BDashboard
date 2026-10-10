// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import DisbursementBatchHistory from "./DisbursementBatchHistory";
import type { FinancialAccount } from "@/lib/services/entities";
import type { MixedPayoutBatch } from "@/lib/services/payoutBatches";

vi.mock("@/lib/config/stellarFeatures", async () => {
  const actual = await vi.importActual<typeof import("@/lib/config/stellarFeatures")>(
    "@/lib/config/stellarFeatures",
  );
  return {
    ...actual,
    MIXED_RAIL_BULK_PAYOUTS_ENABLED: true,
  };
});

vi.mock("@/lib/services/payoutBatches", async () => {
  const actual = await vi.importActual<typeof import("@/lib/services/payoutBatches")>(
    "@/lib/services/payoutBatches",
  );
  return {
    ...actual,
    payoutBatchesApi: {
      listBatches: vi.fn(),
      getBatch: vi.fn(),
      syncBatch: vi.fn(),
    },
  };
});

import { payoutBatchesApi } from "@/lib/services/payoutBatches";

const account: FinancialAccount = {
  id: "acct_1",
  entityId: "ent_1",
  assetType: "stablecoin",
  currency: "USDC",
  network: "Stellar",
  status: "active",
};

function batch(overrides: Partial<MixedPayoutBatch> = {}): MixedPayoutBatch {
  return {
    batch_id: "7",
    status: "completed",
    total_items: 1,
    stellar_item_count: 1,
    fiat_item_count: 0,
    items: [],
    ...overrides,
  };
}

describe("DisbursementBatchHistory (mixed-rail)", () => {
  it("shows Refresh status for batches with Stellar rows", async () => {
    vi.mocked(payoutBatchesApi.listBatches).mockResolvedValue([
      batch({ batch_id: "9", status: "processing", stellar_item_count: 1 }),
    ]);
    vi.mocked(payoutBatchesApi.getBatch).mockResolvedValue(
      batch({ batch_id: "9", status: "processing", items: [] }),
    );

    render(<DisbursementBatchHistory sourceAccounts={[account]} onDone={vi.fn()} />);

    const toggle = await screen.findByRole("button", { name: /Batch 9/i });
    fireEvent.click(toggle);

    expect(await screen.findByRole("button", { name: /Refresh status/i })).toBeInTheDocument();
  });

  it("hides Refresh status for fiat-only batches", async () => {
    vi.mocked(payoutBatchesApi.listBatches).mockResolvedValue([
      batch({
        batch_id: "8",
        status: "processing",
        stellar_item_count: 0,
        fiat_item_count: 1,
      }),
    ]);
    vi.mocked(payoutBatchesApi.getBatch).mockResolvedValue(
      batch({
        batch_id: "8",
        status: "processing",
        stellar_item_count: 0,
        fiat_item_count: 1,
        items: [],
      }),
    );

    render(<DisbursementBatchHistory sourceAccounts={[account]} onDone={vi.fn()} />);

    const toggle = await screen.findByRole("button", { name: /Batch 8/i });
    fireEvent.click(toggle);

    await waitFor(() =>
      expect(screen.getByText(/No item detail available for this batch/i)).toBeInTheDocument(),
    );
    expect(screen.queryByRole("button", { name: /Refresh status/i })).not.toBeInTheDocument();
  });

  it("renders mixed-rail item badges once detail loads", async () => {
    vi.mocked(payoutBatchesApi.listBatches).mockResolvedValue([
      batch({ batch_id: "7", status: "completed", items: [] }),
    ]);
    vi.mocked(payoutBatchesApi.getBatch).mockResolvedValue(
      batch({
        batch_id: "7",
        status: "completed",
        stellar_item_count: 1,
        fiat_item_count: 1,
        total_items: 2,
        items: [
          {
            row_index: 1,
            rail: "stellar",
            recipient_label: "GAAA",
            amount: "2",
            currency: "USDC",
            status: "completed",
            tx_hash: "hash_abc",
          },
          {
            row_index: 2,
            rail: "mobile_money",
            recipient_label: "+254711111111",
            amount: "1500",
            currency: "KES",
            status: "failed",
            failure_code: "quote_expired",
          },
        ],
      }),
    );

    render(<DisbursementBatchHistory sourceAccounts={[account]} onDone={vi.fn()} />);

    const toggle = await screen.findByRole("button", { name: /Batch 7/i });
    fireEvent.click(toggle);

    expect(await screen.findByText("GAAA")).toBeInTheDocument();
    expect(screen.getByText("+254711111111")).toBeInTheDocument();
    expect(screen.getAllByText(/Mobile money|Stellar/).length).toBeGreaterThanOrEqual(2);
  });
});
