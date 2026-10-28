// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  methods: vi.fn(),
  banks: vi.fn(),
  preview: vi.fn(),
  confirm: vi.fn(),
}));
vi.mock("@/lib/services/payouts", () => ({ payoutsApi: api }));

import PayoutModal, { payoutFeeText } from "./PayoutModal";

const account = { id: "acc_cad", currency: "CAD" } as never;

describe("PayoutModal", () => {
  beforeEach(() => {
    api.methods.mockReset().mockResolvedValue([{ id: "interac", label: "Interac e-Transfer" }]);
    api.banks.mockReset().mockResolvedValue({ banks: [] });
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
    expect(api.confirm.mock.calls[0][2]).toEqual({ preview_token: "tok_1234567890abcdef" });
  });

  it("loads banks and posts beneficiary + bank for KES ke_eft", async () => {
    api.methods.mockResolvedValue([
      {
        scheme: "ke_eft",
        country: "KE",
        default: true,
        required_fields: ["bank_code", "account_number", "bank_name", "account_holder_name"],
      },
    ]);
    api.banks.mockResolvedValue({
      banks: [{ bank_code: "01", bank_name: "KCB" }],
    });
    api.preview.mockResolvedValue({
      preview_token: "tok_kes",
      amount: "5000.00",
      receive_amount: "5000.00",
      fee: "450.00",
      total_debit: "5450.00",
      currency: "KES",
      scheme: "ke_eft",
    });

    const kesAccount = { id: "acc_kes", currency: "KES" } as never;
    render(<PayoutModal entityId="ent_1" account={kesAccount} onDone={vi.fn()} onCancel={vi.fn()} />);

    await waitFor(() => expect(screen.getByRole("option", { name: "Kenya bank transfer" })).toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole("option", { name: "KCB" })).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText("Account number"), { target: { value: "1234567890" } });
    fireEvent.change(screen.getByLabelText("Account holder name"), { target: { value: "Jane Doe" } });
    fireEvent.change(screen.getByLabelText("Recipient first name"), { target: { value: "Jane" } });
    fireEvent.change(screen.getByLabelText("Recipient last name"), { target: { value: "Doe" } });
    fireEvent.change(screen.getByLabelText("Recipient email"), { target: { value: "jane@example.com" } });
    fireEvent.change(screen.getByLabelText("Recipient street address"), { target: { value: "1 Street" } });
    fireEvent.change(screen.getByLabelText("Recipient city"), { target: { value: "Nairobi" } });
    fireEvent.change(screen.getByLabelText("Recipient postal code"), { target: { value: "00100" } });
    fireEvent.change(screen.getByLabelText("Amount (KES)"), { target: { value: "5000" } });
    fireEvent.click(screen.getByRole("button", { name: "Review payout" }));

    await waitFor(() => expect(api.preview).toHaveBeenCalledTimes(1));
    expect(api.preview.mock.calls[0][2]).toMatchObject({
      amount: "5000",
      bank: { bank_code: "01", account_number: "1234567890", scheme: "ke_eft" },
      beneficiary: { address: { postal_code: "00100" } },
    });

    expect(await screen.findByText("5,450.00 KES")).toBeInTheDocument();
    expect(screen.getByText("450.00 KES")).toBeInTheDocument();
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
