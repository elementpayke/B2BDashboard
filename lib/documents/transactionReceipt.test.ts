import { describe, expect, it } from "vitest";
import { renderBrandedDocument } from "@/lib/documents/brandedDocument";
import {
  buildTransactionReceipt,
  isReceiptable,
  receiptFilename,
  type ReceiptTransaction,
} from "@/lib/documents/transactionReceipt";

const settledPayout: ReceiptTransaction = {
  id: 4821,
  direction: "out",
  status: "completed",
  amount_fiat: "41300.00",
  currency: "KES",
  aggregator_order_id: "AGG-77123",
  external_order_id: "inv-2026-014",
  wallet_address: "0x9F2c4a8b1E5d7a3c91F0bD2e4cAb7fE6Dd31B0c4a",
  created_at: "2026-08-14T09:15:00Z",
  updated_at: "2026-08-14T09:17:30Z",
};

describe("isReceiptable", () => {
  it("only offers a receipt once the order has settled", () => {
    expect(isReceiptable("completed")).toBe(true);
    expect(isReceiptable("processing")).toBe(false);
    expect(isReceiptable("failed")).toBe(false);
    expect(isReceiptable("refunded")).toBe(false);
    expect(isReceiptable(undefined)).toBe(false);
  });
});

describe("buildTransactionReceipt", () => {
  it("labels an outbound order as a payout and carries both references", () => {
    const doc = buildTransactionReceipt(settledPayout);
    expect(doc.heading).toBe("Payout receipt");
    expect(doc.amount).toBe("KES 41300.00");
    expect(doc.amountCaption).toBe("Sent");

    const reference = doc.sections.find((s) => s.title === "Reference");
    expect(reference?.rows.map((r) => r.value)).toEqual([
      "4821",
      "AGG-77123",
      "inv-2026-014",
    ]);
  });

  it("labels an inbound order as a deposit", () => {
    const doc = buildTransactionReceipt({ ...settledPayout, direction: "in" });
    expect(doc.heading).toBe("Deposit receipt");
    expect(doc.amountCaption).toBe("Received");
  });

  it("omits reference and settlement rows the order does not carry", () => {
    const doc = buildTransactionReceipt({
      id: 7,
      direction: "unknown",
      status: "completed",
      amount_fiat: "10.00",
      currency: "USD",
      aggregator_order_id: null,
      external_order_id: null,
      wallet_address: null,
      created_at: null,
      updated_at: null,
    });
    expect(doc.heading).toBe("Transaction receipt");
    expect(doc.sections.find((s) => s.title === "Reference")?.rows).toHaveLength(1);
    expect(
      doc.sections.find((s) => s.title === "Settlement")?.rows.map((r) => r.label),
    ).toEqual(["Settlement layer"]);
  });

  it("collapses the settled row when it matches created", () => {
    const doc = buildTransactionReceipt({
      ...settledPayout,
      updated_at: settledPayout.created_at,
    });
    const labels = doc.sections.find((s) => s.title === "Settlement")?.rows.map((r) => r.label);
    expect(labels).not.toContain("Settled");
  });
});

describe("receiptFilename", () => {
  it("prefers the aggregator reference and stays filesystem-safe", () => {
    expect(receiptFilename(settledPayout)).toBe("mboka-receipt-agg-77123");
    expect(
      receiptFilename({ ...settledPayout, aggregator_order_id: "AGG/77 123" }),
    ).toBe("mboka-receipt-agg-77-123");
  });

  it("falls back to the order id", () => {
    expect(
      receiptFilename({
        ...settledPayout,
        aggregator_order_id: null,
        external_order_id: null,
      }),
    ).toBe("mboka-receipt-4821");
  });
});

describe("renderBrandedDocument", () => {
  it("escapes values so a recipient name cannot inject markup", () => {
    const html = renderBrandedDocument(
      buildTransactionReceipt({
        ...settledPayout,
        external_order_id: '<img src=x onerror="alert(1)">',
      }),
    );
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
  });

  it("embeds the mark inline rather than linking an asset", () => {
    const html = renderBrandedDocument(buildTransactionReceipt(settledPayout));
    expect(html).toContain('<svg viewBox="0 0 44 44"');
    expect(html).toContain("#3B2ED3");
    // Back block stays at 45% of the front — never equalise them.
    expect(html).toContain('fill-opacity="0.45"');
  });
});
