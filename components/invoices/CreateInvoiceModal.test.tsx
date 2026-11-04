// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import CreateInvoiceModal from "./CreateInvoiceModal";

vi.mock("@/lib/services/invoices", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/services/invoices")>();
  return {
    ...mod,
    invoicesApi: {
      ...mod.invoicesApi,
      nextId: vi.fn().mockResolvedValue({ next_invoice_number: "inv-2026-0099" }),
      create: vi.fn(),
    },
  };
});

const customer = {
  id: "cust-1",
  name: "Joseph Thuku",
  email: "j@example.com",
  country: "KE",
  created_at: null,
  updated_at: null,
};

function renderModal() {
  return render(
    <CreateInvoiceModal
      customers={[customer]}
      onRefreshCustomers={vi.fn()}
      onSaveCustomer={vi.fn()}
      onClose={vi.fn()}
      onCreated={vi.fn()}
    />,
  );
}

function completeStep1() {
  const billTo = screen.getByText("Bill to").parentElement?.querySelector("select");
  if (!billTo) throw new Error("customer select missing");
  fireEvent.change(billTo, { target: { value: "cust-1" } });
  fireEvent.change(screen.getByPlaceholderText("Item name"), { target: { value: "Software development" } });
  fireEvent.change(screen.getByPlaceholderText("Unit price"), { target: { value: "1000" } });
  fireEvent.click(screen.getByRole("button", { name: "+ Add item" }));
  fireEvent.click(screen.getByRole("button", { name: "Continue to payment methods" }));
}

describe("CreateInvoiceModal layout", () => {
  it("renders payment method cards with inputs inside each label", () => {
    renderModal();
    completeStep1();

    const usdc = screen.getByText("USDC").closest("label");
    expect(usdc).toHaveClass("ep-invoices-method-card");
    expect(usdc?.querySelector('input[type="checkbox"]')).toBeTruthy();
    expect(screen.getByText(/Any network.*Stellar/)).toBeTruthy();
  });

  it("renders settlement options as selectable rows", () => {
    renderModal();
    completeStep1();

    const settlement = screen.getByText("Convert everything to USDC on Stellar").closest("label");
    expect(settlement).toHaveClass("ep-invoices-settlement-card");
    expect(settlement?.querySelector('input[type="radio"]')).toBeTruthy();
  });

  it("shows review pay rows without merging label and detail", () => {
    renderModal();
    completeStep1();
    fireEvent.click(screen.getByRole("button", { name: "Review invoice" }));

    const row = screen.getByText("USDC").closest(".ep-invoices-preview-pay-row");
    expect(row).toBeTruthy();
    expect(row?.querySelector(".ep-invoices-muted")?.textContent).toMatch(/Stellar/);
  });
});
