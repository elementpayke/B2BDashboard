// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import DisbursementBatchHistory from "./DisbursementBatchHistory";
import type { FinancialAccount } from "@/lib/services/entities";
import type { BulkStellarPayoutBatch } from "@/lib/services/stellarDisbursements";

vi.mock("@/lib/services/stellarDisbursements", async () => {
  const actual = await vi.importActual<typeof import("@/lib/services/stellarDisbursements")>(
    "@/lib/services/stellarDisbursements",
  );
  return {
    ...actual,
    stellarDisbursementsApi: {
      listBatches: vi.fn(),
      getBatch: vi.fn(),
      syncBatch: vi.fn(),
      reconcileBatch: vi.fn(),
    },
  };
});

import { stellarDisbursementsApi } from "@/lib/services/stellarDisbursements";

const account: FinancialAccount = {
  id: "acct_1",
  entityId: "ent_1",
  assetType: "stablecoin",
  currency: "USDC",
  network: "Stellar",
  status: "active",
};

function batch(overrides: Partial<BulkStellarPayoutBatch> = {}): BulkStellarPayoutBatch {
  return {
    batch_id: "7",
    status: "completed",
    currency: "USDC",
    total_amount: "7",
    item_count: 1,
    items: [],
    ...overrides,
  };
}

describe("DisbursementBatchHistory", () => {
  it("shows a sync hint banner and actionable empty state for a non-terminal batch", async () => {
    vi.mocked(stellarDisbursementsApi.listBatches).mockResolvedValue([
      batch({ batch_id: "9", status: "processing" }),
    ]);
    vi.mocked(stellarDisbursementsApi.getBatch).mockResolvedValue(
      batch({ batch_id: "9", status: "processing", items: [] }),
    );

    render(<DisbursementBatchHistory sourceAccounts={[account]} onDone={vi.fn()} />);

    const toggle = await screen.findByRole("button", { name: /Batch 9/i });
    fireEvent.click(toggle);

    expect(
      await screen.findByText(/Still processing — tap Sync status for the latest/i),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(/Item detail isn't ready yet — tap Sync status above/i),
    ).toBeInTheDocument();
  });

  it("hides the sync hint banner and shows a terminal empty state for a completed batch", async () => {
    vi.mocked(stellarDisbursementsApi.listBatches).mockResolvedValue([
      batch({ batch_id: "7", status: "completed" }),
    ]);
    vi.mocked(stellarDisbursementsApi.getBatch).mockResolvedValue(
      batch({ batch_id: "7", status: "completed", items: [] }),
    );

    render(<DisbursementBatchHistory sourceAccounts={[account]} onDone={vi.fn()} />);

    const toggle = await screen.findByRole("button", { name: /Batch 7/i });
    fireEvent.click(toggle);

    await waitFor(() =>
      expect(screen.getByText(/No item detail available for this batch/i)).toBeInTheDocument(),
    );
    expect(screen.queryByText(/Still processing/i)).not.toBeInTheDocument();
  });

  it("renders item rows once detail loads, without a fallback message", async () => {
    vi.mocked(stellarDisbursementsApi.listBatches).mockResolvedValue([
      batch({ batch_id: "7", status: "completed", items: [] }),
    ]);
    vi.mocked(stellarDisbursementsApi.getBatch).mockResolvedValue(
      batch({
        batch_id: "7",
        status: "completed",
        items: [
          { destination: "GAAA", amount: "2", status: "completed", tx_hash: "hash_abc" },
        ],
      }),
    );

    render(<DisbursementBatchHistory sourceAccounts={[account]} onDone={vi.fn()} />);

    const toggle = await screen.findByRole("button", { name: /Batch 7/i });
    fireEvent.click(toggle);

    expect(await screen.findByText("GAAA")).toBeInTheDocument();
    expect(screen.queryByText(/No item detail available/i)).not.toBeInTheDocument();
  });
});
