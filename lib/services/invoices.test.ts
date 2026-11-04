import { describe, it, expect } from "vitest";
import {
  assertInvoiceUiCopyClean,
  buildCreatePayloadFromWizard,
  buildSimpleDraftPayload,
  clampInvoiceListLimit,
  formatInvoiceAmount,
  formatMoneyAmount,
  INVOICE_LIST_MAX_LIMIT,
  mapInvoiceToListRow,
  resolveUiStatus,
  shareMessage,
  summarizeInvoices,
} from "./invoices";

describe("invoices mappers", () => {
  it("clamps list limit to Mboka maximum", () => {
    expect(INVOICE_LIST_MAX_LIMIT).toBe(200);
    expect(clampInvoiceListLimit(500)).toBe(200);
    expect(clampInvoiceListLimit(100)).toBe(100);
  });

  it("builds a minimal valid DraftPayloadIn from the dashboard's simple client+amount form", () => {
    const payload = buildSimpleDraftPayload("Acme GmbH", "4500.00");
    expect(payload.currency).toBe("USD");
    expect(payload.client_name).toBe("Acme GmbH");
    expect(payload.methods).toContain("usdc");
    expect(payload.line_items).toHaveLength(1);
  });

  it("maps invoice list row with ui status", () => {
    const row = mapInvoiceToListRow({
      id: 1,
      business_id: 1,
      draft_id: null,
      invoice_number: "inv-2026-0001",
      status: "pending",
      ui_status: "overdue",
      payload: {
        currency: "USD",
        client_name: "Acme",
        amount: "100",
        methods: ["usdc", "mpesa"],
        due_date: "Sep 15, 2026",
        line_items: [],
      },
      send_via: null,
      sent_at: null,
      paid_at: null,
      public_token: null,
      created_at: null,
      updated_at: null,
    });
    expect(row.displayId).toBe("INV-2026-0001");
    expect(row.status).toBe("overdue");
    expect(row.methods).toEqual(["usdc", "mpesa"]);
  });

  it("formats amounts with two decimals", () => {
    expect(formatInvoiceAmount(2500, "USD")).toBe("2,500.00 USD");
  });

  it("formatMoneyAmount does not throw for USDC summary currency", () => {
    expect(() => formatMoneyAmount(100, "USDC")).not.toThrow();
    expect(formatMoneyAmount(100, "USDC")).toMatch(/100/);
  });

  it("summarizeInvoices aggregates from list rows", () => {
    const base = {
      business_id: 1,
      draft_id: null,
      send_via: null,
      sent_at: null,
      paid_at: null,
      public_token: null,
      created_at: null,
      updated_at: null,
      payload: {
        currency: "USD",
        client_name: "Acme",
        amount: "100",
        methods: ["usdc"] as const,
        line_items: [],
      },
    };
    const summary = summarizeInvoices([
      { ...base, id: 1, invoice_number: "inv-1", status: "pending", ui_status: "pending" },
      { ...base, id: 2, invoice_number: "inv-2", status: "paid", ui_status: "paid" },
    ]);
    expect(summary.total_invoiced).toBe("200");
    expect(summary.total_paid).toBe("100");
    expect(summary.total_pending).toBe("100");
  });

  it("buildCreatePayloadFromWizard sets stellar when usdc enabled", () => {
    const p = buildCreatePayloadFromWizard({
      clientName: "Kigali Roasters",
      clientEmail: "a@b.co",
      currency: "USD",
      description: "Coffee",
      dueDate: "2026-09-30",
      lineItems: [{ name: "Supply", qty: 1, unit_price: "980" }],
      methods: ["usdc", "mpesa"],
      settlement: "asset",
      allowPartial: true,
      emailOnCreate: true,
    });
    expect(p.network).toBe("stellar");
    expect(p.amount).toBe("980");
  });

  it("share message uses PDF reference copy", () => {
    const msg = shareMessage({
      id: 2,
      business_id: 1,
      draft_id: null,
      invoice_number: "inv-2026-0042",
      status: "pending",
      payload: {
        currency: "USD",
        client_name: "Acme",
        amount: "100",
        due_date: "Sep 30, 2026",
        line_items: [],
      },
      send_via: null,
      sent_at: null,
      paid_at: null,
      public_token: null,
      created_at: null,
      updated_at: null,
    });
    expect(msg).toContain("attached PDF");
    assertInvoiceUiCopyClean(msg);
  });

  it("resolveUiStatus falls back from backend status", () => {
    expect(
      resolveUiStatus({
        id: 1,
        business_id: 1,
        draft_id: null,
        invoice_number: "x",
        status: "partially_paid",
        payload: { currency: "USD", line_items: [] },
        send_via: null,
        sent_at: null,
        paid_at: null,
        public_token: null,
        created_at: null,
        updated_at: null,
      }),
    ).toBe("partially_paid");
  });
});
