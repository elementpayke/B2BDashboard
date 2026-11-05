// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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

vi.mock("@/lib/services/invoiceBranding", () => ({
  invoiceBrandingApi: {
    get: vi.fn().mockResolvedValue({ issuer_name: null, address_lines: [], logo_data_url: null }),
  },
}));

const customer = {
  id: "cust-1",
  name: "Joseph Thuku",
  email: "j@example.com",
  country: "KE",
  created_at: null,
  updated_at: null,
};

function renderModal() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <CreateInvoiceModal
        customers={[customer]}
        onRefreshCustomers={vi.fn()}
        onSaveCustomer={vi.fn()}
        onClose={vi.fn()}
        onCreated={vi.fn()}
      />
    </QueryClientProvider>,
  );
}

function completeStep1() {
  const billTo = screen.getByText("Bill to").parentElement?.querySelector("select");
  if (!billTo) throw new Error("customer select missing");
  fireEvent.change(billTo, { target: { value: "cust-1" } });
  fireEvent.change(screen.getByPlaceholderText("Item name"), { target: { value: "Software development" } });
  fireEvent.change(screen.getByPlaceholderText("Unit price"), { target: { value: "1000" } });
  fireEvent.click(screen.getByRole("button", { name: "+ Add item" }));
  fireEvent.click(screen.getByRole("button", { name: "Continue to settlement" }));
}

describe("CreateInvoiceModal layout", () => {
  it("steps straight to a Stellar USDC settlement banner — no method or settlement picker", () => {
    renderModal();
    completeStep1();

    expect(screen.getByText("Stellar · USDC")).toBeTruthy();
    expect(screen.getByText(/M-Pesa, bank transfer, and USDT are on the roadmap/)).toBeTruthy();
    expect(document.querySelector(".ep-invoices-method-card")).toBeNull();
    expect(document.querySelector(".ep-invoices-settlement-card")).toBeNull();
  });

  it("shows review pay rows without merging label and detail", () => {
    renderModal();
    completeStep1();
    fireEvent.click(screen.getByRole("button", { name: "Review invoice" }));

    const row = screen.getByText("USDC").closest(".ep-invoices-preview-pay-row");
    expect(row).toBeTruthy();
    expect(row?.querySelector(".ep-invoices-muted")?.textContent).toMatch(/Stellar/);
    expect(screen.getByText("Settles to your USDC account on Stellar")).toBeTruthy();
  });
});
