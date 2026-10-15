// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  methods: vi.fn(),
  preview: vi.fn(),
  confirm: vi.fn(),
}));
vi.mock("@/lib/services/payouts", () => ({ payoutsApi: api }));

import PayoutModal, { payoutFeeText } from "./PayoutModal";

const account = { id: "acc_cad", currency: "CAD" } as never;

describe("PayoutModal", () => {
  beforeEach(() => {
    api.methods.mockReset().mockResolvedValue([{ id: "interac", label: "Interac e-Transfer" }]);
    api.preview.mockReset();
    api.confirm.mockReset().mockResolvedValue({ id: "po_1", status: "pending" });
  });

  async function fillAndReview() {
    render(<PayoutModal entityId="ent_1" account={account} onDone={vi.fn()} onCancel={vi.fn()} />);
    await waitFor(() => expect(screen.getByRole("option", { name: "Interac e-Transfer" })).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText("Destination (email / account)"), { target: { value: "ap@acme.com" } });
    fireEvent.change(screen.getByLabelText("Amount (CAD)"), { target: { value: "250" } });
    fireEvent.click(screen.getByRole("button", { name: "Review payout" }));
  }

  it("previews first and shows amount and fee before anything is sent", async () => {
    api.preview.mockResolvedValue({
      preview_token: "tok_1234567890abcdef",
      amount: "250.00",
      fee: "1.50",
      currency: "CAD",
      scheme: "Interac",
      expires_at: new Date(Date.now() + 120_000).toISOString(),
    });
    await fillAndReview();

    expect(await screen.findByText("Step 2 · Review & confirm")).toBeInTheDocument();
    expect(screen.getByText("250.00 CAD")).toBeInTheDocument();
    expect(screen.getByText("1.50 CAD")).toBeInTheDocument();
    expect(screen.getByText(/^for \d:\d\d$/)).toBeInTheDocument();
    expect(api.confirm).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Send 250.00 CAD" }));
    await waitFor(() => expect(api.confirm).toHaveBeenCalledTimes(1));
    expect(api.confirm.mock.calls[0][2]).toMatchObject({ preview_token: "tok_1234567890abcdef" });
  });

  it("goes back to edit without confirming", async () => {
    api.preview.mockResolvedValue({ preview_token: "tok_1234567890abcdef", amount: "250.00", fee: null, currency: "CAD" });
    await fillAndReview();
    fireEvent.click(await screen.findByRole("button", { name: "Back" }));
    expect(screen.getByRole("button", { name: "Review payout" })).toBeInTheDocument();
    expect(api.confirm).not.toHaveBeenCalled();
  });
});

describe("payoutFeeText", () => {
  it("never invents a fee", () => {
    expect(payoutFeeText({ fee: "2.00", currency: "CAD" }, "CAD")).toBe("2.00 CAD");
    expect(payoutFeeText({ fee: "0" }, "CAD")).toBe("No fee");
    expect(payoutFeeText({ fee: null, fee_status: "pending_confirm" }, "CAD")).toMatch(/shown once confirmed/);
    expect(payoutFeeText({}, "CAD")).toBe("Not quoted for this method");
  });
});
