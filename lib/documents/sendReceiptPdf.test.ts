// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SendReceiptDoc } from "./sendReceiptPdf";

/** Fresh module each time so the font cache doesn't leak between tests. */
async function build() {
  vi.resetModules();
  const { buildSendReceiptPdf } = await import("./sendReceiptPdf");
  return buildSendReceiptPdf(receipt, "mboka-receipt-92");
}

const receipt: SendReceiptDoc = {
  pending: false,
  orderId: "92",
  paidAt: "25 Nov 2026, 17:15",
  statusText: "Completed",
  sourceLabel: "USDT · Polygon",
  recipientName: "Joseph Thuku",
  toLines: ["M-Pesa, Kenya", "0110919165"],
  rows: [
    { label: "Channel", value: "M-Pesa" },
    { label: "Account", value: "0110919165" },
    { label: "Amount sent", value: "1 USD" },
    { label: "Transfer fee", value: "Included in the rate" },
    { label: "Exchange rate", value: "1 USD = 128.90 KES/USDT" },
  ],
  totalText: "1.0 USDT",
  getsLabel: "Amount received by beneficiary",
  getsText: "128.9 KES",
  meta: [
    { label: "Payment method", value: "Mobile money" },
    { label: "Transaction ID", value: "92", mono: true },
  ],
  footnote: "This receipt was generated electronically and is valid without a signature.",
  credit: "Mboka is a product of ElementPay",
};

const fontDir = path.join(process.cwd(), "public/fonts/receipt");

async function pdfText(blob: Blob): Promise<string> {
  return new TextDecoder("latin1").decode(await blob.arrayBuffer());
}

afterEach(() => vi.unstubAllGlobals());

describe("buildSendReceiptPdf", () => {
  it("embeds the brand fonts the preview uses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const file = readFileSync(path.join(fontDir, path.basename(url)));
        return new Response(file);
      }),
    );
    const { blob, filename } = await build();
    expect(filename).toBe("mboka-receipt-92.pdf");
    const raw = await pdfText(blob);
    for (const font of ["SpaceGrotesk-Bold", "DMSans-Regular", "DMMono-Regular", "DMMono-Medium"]) {
      expect(raw).toContain(`/BaseFont /${font}`);
    }
  });

  it("still builds with built-in fonts when the brand fonts can't load", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 404 })));
    const { blob } = await build();
    const raw = await pdfText(blob);
    expect(raw).toContain("Helvetica");
    expect(raw).toContain("(Channel)");
    expect(raw).toContain("(0110919165)");
  });
});
