// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ preview: vi.fn(), confirm: vi.fn() }));
vi.mock("@/lib/services/bookTransfers", async () => {
  const actual = await vi.importActual<typeof import("@/lib/services/bookTransfers")>(
    "@/lib/services/bookTransfers",
  );
  return { ...actual, bookTransfersApi: api };
});

import BookTransferModal from "./BookTransferModal";

const source = { id: "acc_eur_1", currency: "EUR", assetType: "fiat" } as never;
const candidates = [
  { id: "acc_eur_1", currency: "EUR", assetType: "fiat" },
  { id: "acc_eur_2", currency: "EUR", assetType: "fiat" },
] as never[];

function open() {
  render(
    <BookTransferModal
      entityId="ent_1"
      source={source}
      candidates={candidates}
      onDone={vi.fn()}
      onCancel={vi.fn()}
    />,
  );
  fireEvent.change(screen.getByDisplayValue(""), { target: { value: "500" } });
  fireEvent.click(screen.getByRole("button", { name: "Review move" }));
}

describe("BookTransferModal", () => {
  beforeEach(() => {
    api.preview.mockReset();
    api.confirm.mockReset().mockResolvedValue({ id: "bt_1", status: "completed" });
  });

  it("never confirms straight off the first click", async () => {
    api.preview.mockResolvedValue({
      preview_token: "tok_1",
      amount: "500.00",
      currency: "EUR",
      fee: "0.00",
    });
    open();

    expect(await screen.findByText("Step 2 · Review & confirm")).toBeInTheDocument();
    expect(api.preview).toHaveBeenCalledTimes(1);
    expect(api.confirm).not.toHaveBeenCalled();
  });

  it("shows amount, an explicit No fee, and the total before the user commits", async () => {
    api.preview.mockResolvedValue({
      preview_token: "tok_1",
      amount: "500.00",
      currency: "EUR",
      fee: "0.00",
    });
    open();

    await screen.findByText("Step 2 · Review & confirm");
    expect(screen.getByText("Amount")).toBeInTheDocument();
    expect(screen.getByText("No fee")).toBeInTheDocument();
    // Fee is an explicit zero, so the total is the amount — an identity, not
    // a client-side sum. Both rows carry it.
    expect(screen.getByText("Total deducted")).toBeInTheDocument();
    expect(screen.getAllByText("500.00 EUR")).toHaveLength(2);
  });

  it("shows a real fee and the aggregator's own total", async () => {
    api.preview.mockResolvedValue({
      preview_token: "tok_1",
      amount: "500.00",
      currency: "EUR",
      fee: "1.25",
      total_debit: "501.25",
    });
    open();

    await screen.findByText("Step 2 · Review & confirm");
    expect(screen.getByText("1.25 EUR")).toBeInTheDocument();
    expect(screen.getByText("501.25 EUR")).toBeInTheDocument();
  });

  it("says when an unpriced fee lands rather than implying the move is free", async () => {
    api.preview.mockResolvedValue({
      preview_token: "tok_1",
      amount: "500.00",
      currency: "EUR",
    });
    open();

    await screen.findByText("Step 2 · Review & confirm");
    expect(screen.queryByText("No fee")).toBeNull();
    expect(screen.getAllByText("Shown on your statement once settled")).toHaveLength(2);
  });

  it("confirms with the preview token only after the review step", async () => {
    api.preview.mockResolvedValue({
      preview_token: "tok_1",
      amount: "500.00",
      currency: "EUR",
      fee: "0.00",
    });
    open();

    await screen.findByText("Step 2 · Review & confirm");
    fireEvent.click(screen.getByRole("button", { name: "Confirm move" }));
    await waitFor(() => expect(api.confirm).toHaveBeenCalledTimes(1));
    expect(api.confirm.mock.calls[0][2]).toMatchObject({ preview_token: "tok_1" });
  });

  it("goes back to the form without sending anything", async () => {
    api.preview.mockResolvedValue({
      preview_token: "tok_1",
      amount: "500.00",
      currency: "EUR",
      fee: "0.00",
    });
    open();

    await screen.findByText("Step 2 · Review & confirm");
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(await screen.findByRole("button", { name: "Review move" })).toBeInTheDocument();
    expect(api.confirm).not.toHaveBeenCalled();
  });
});
