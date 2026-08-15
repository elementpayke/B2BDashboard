import { describe, expect, it } from "vitest";
import { renderBrandedDocument } from "@/lib/documents/brandedDocument";
import {
  buildStellarDetailRows,
  buildStellarReceipt,
  isStellarReceiptable,
  presentStellarActivity,
} from "@/lib/services/stellarPresentation";
import type { StellarActivity } from "@/lib/services/stellarSimulation";

const NOW = new Date("2026-08-15T12:00:00Z");
const HASH = "3f1a9c47d2b85e60a1c4f8d93e27b5061a8c4f2d9e73b16a5c08d4f291e6b73a";

const settled: StellarActivity = {
  id: "stx-2",
  title: "External wallet deposit",
  subtitle: "USDC Account funding",
  amount: "+65,000.00",
  direction: "in",
  status: "settled",
  createdAt: "2026-08-14T16:12:00Z",
  txHash: HASH,
  memo: "MBOKA-4821",
  asset: "USDC",
  network: "Stellar",
};

const pending: StellarActivity = {
  ...settled,
  id: "stx-1",
  amount: "+18,400.00",
  status: "pending_deposit",
  txHash: null,
};

const needsReview: StellarActivity = {
  ...settled,
  id: "stx-5",
  status: "review_required",
  memo: null,
};

const payout: StellarActivity = {
  ...settled,
  id: "stx-4",
  title: "Supplier payout · Lagos",
  subtitle: "USDC Account payout",
  amount: "-8,200.00",
  direction: "out",
  status: "processing_payout",
  txHash: null,
};

describe("presentStellarActivity", () => {
  it("maps onto the shared ActivityItem shape with the asset in the amount", () => {
    const item = presentStellarActivity(settled, NOW);
    expect(item.client).toBe("External wallet deposit");
    expect(item.amount).toBe("+USDC 65,000.00");
    expect(item.amountColor).toBe("var(--success)");
    expect(item.statusLabel).toBe("Settled");
    expect(item.dateLabel).toMatch(/Yesterday/);
  });

  it("signs an outbound transfer and does not colour it as a credit", () => {
    const item = presentStellarActivity(payout, NOW);
    expect(item.amount).toBe("−USDC 8,200.00");
    expect(item.amountColor).toBe("var(--ink)");
    expect(item.statusLabel).toBe("Processing payout");
  });

  it("carries the operational statuses through with their own labels", () => {
    expect(presentStellarActivity(pending, NOW).statusLabel).toBe("Pending deposit");
    expect(presentStellarActivity(needsReview, NOW).statusLabel).toBe("Review required");
  });

  it("only puts the reference in the meta line when there is one", () => {
    expect(presentStellarActivity(settled, NOW).meta).toContain("Ref MBOKA-4821");
    expect(presentStellarActivity(needsReview, NOW).meta).not.toContain("Ref");
  });
});

describe("buildStellarDetailRows", () => {
  it("always states asset and network", () => {
    // Pending: the sender included a reference, but there is no hash yet.
    const labels = buildStellarDetailRows(pending).map((r) => r.label);
    expect(labels).toEqual(["Asset", "Network", "Payment reference"]);
    expect(labels).not.toContain("Transaction hash");

    const bare = buildStellarDetailRows({ ...pending, memo: null });
    expect(bare.map((r) => r.label)).toEqual(["Asset", "Network"]);
  });

  it("adds hash and reference only once they exist", () => {
    const rows = buildStellarDetailRows(settled);
    expect(rows.map((r) => r.label)).toEqual([
      "Asset",
      "Network",
      "Transaction hash",
      "Payment reference",
    ]);
    // Truncated for the row; the explorer link carries the full value.
    expect(rows[2].value).toBe("3f1a9c47…91e6b73a");
    expect(rows[2].href).toBe(`https://stellar.expert/explorer/public/tx/${HASH}`);
  });

  it("omits the reference on a transfer that arrived without one", () => {
    const labels = buildStellarDetailRows(needsReview).map((r) => r.label);
    expect(labels).not.toContain("Payment reference");
    expect(labels).toContain("Transaction hash");
  });

  it("offers no explorer link while the transfer is unconfirmed", () => {
    expect(buildStellarDetailRows(pending).some((r) => r.href)).toBe(false);
  });
});

describe("receipts", () => {
  it("only offers one for a settled transfer", () => {
    expect(isStellarReceiptable("settled")).toBe(true);
    for (const status of ["pending_deposit", "processing_payout", "review_required", "failed"] as const) {
      expect(isStellarReceiptable(status)).toBe(false);
    }
  });

  it("renders network, hash and reference into the branded document", () => {
    const html = renderBrandedDocument(buildStellarReceipt(settled));
    expect(html).toContain("Deposit receipt");
    expect(html).toContain("USDC 65,000.00");
    expect(html).toContain("Stellar");
    expect(html).toContain(HASH);
    expect(html).toContain("MBOKA-4821");
  });

  it("labels an outbound transfer as a payout", () => {
    const doc = buildStellarReceipt(payout);
    expect(doc.heading).toBe("Payout receipt");
    expect(doc.amountCaption).toBe("Sent");
  });

  it("omits rows the transfer does not carry", () => {
    const doc = buildStellarReceipt(needsReview);
    const labels = doc.sections.flatMap((s) => s.rows.map((r) => r.label));
    expect(labels).not.toContain("Payment reference");
  });
});
