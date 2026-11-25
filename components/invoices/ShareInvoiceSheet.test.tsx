// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ShareInvoiceSheet from "./ShareInvoiceSheet";
import { assertInvoiceUiCopyClean } from "@/lib/services/invoices";

vi.mock("@/lib/services/invoices", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/services/invoices")>();
  return {
    ...mod,
    invoicesApi: { ...mod.invoicesApi, downloadPdf: vi.fn() },
  };
});

describe("ShareInvoiceSheet", () => {
  it("uses PDF-first copy without payment links", () => {
    render(
      <ShareInvoiceSheet
        invoice={{
          id: 1,
          business_id: 1,
          draft_id: null,
          invoice_number: "inv-2026-0001",
          status: "pending",
          payload: {
            currency: "USD",
            amount: "100",
            due_date: "2026-09-15",
            line_items: [],
            client_name: "Acme",
          },
          send_via: null,
          sent_at: null,
          paid_at: null,
          public_token: null,
          created_at: null,
          updated_at: null,
        }}
        onClose={() => {}}
      />,
    );
    const text = document.body.textContent ?? "";
    expect(screen.getByText(/Payment details are on the invoice PDF/i)).toBeInTheDocument();
    assertInvoiceUiCopyClean(text);
  });
});
