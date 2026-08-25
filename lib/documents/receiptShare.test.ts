import { describe, expect, it } from "vitest";
import {
  RECEIPT_SHARE_METHODS,
  buildReceiptSharePayload,
  buildReceiptShareText,
  emailShareUrl,
  telegramShareUrl,
  whatsappShareUrl,
} from "@/lib/documents/receiptShare";

const doc = {
  fileTitle: "Mboka — payout receipt",
  heading: "Payout receipt",
  statusBadge: "Settled",
  amount: "KES 1,000.00",
  amountCaption: "Amount sent",
  party: "Payout · KES",
  sections: [
    {
      title: "Payment",
      rows: [
        { label: "Recipient", value: "Jane Wanjiku" },
        { label: "M-Pesa number", value: "+254712345678" },
      ],
    },
  ],
  footnote: "Keep this receipt for your records.",
};

describe("receipt share methods", () => {
  it("lists every channel we expose in the share menu", () => {
    expect(RECEIPT_SHARE_METHODS.map((m) => m.id)).toEqual([
      "device",
      "whatsapp",
      "email",
      "sms",
      "telegram",
      "copy",
      "pdf",
      "html",
    ]);
  });

  it("builds a paste-friendly summary with counterparty details", () => {
    const text = buildReceiptShareText(doc);
    expect(text).toContain("Payout receipt");
    expect(text).toContain("Amount sent: KES 1,000.00");
    expect(text).toContain("Recipient: Jane Wanjiku");
    expect(text).toContain("+254712345678");
    expect(text).toContain("Mboka business payments");
  });

  it("builds deep links for WhatsApp, email, and Telegram", () => {
    const payload = buildReceiptSharePayload(doc, "mboka-receipt-inv-1");
    expect(payload.filename).toBe("mboka-receipt-inv-1.html");
    expect(whatsappShareUrl(payload.text)).toContain("wa.me/?text=");
    expect(emailShareUrl(payload.title, payload.text)).toMatch(/^mailto:\?subject=/);
    expect(telegramShareUrl(payload.text)).toContain("t.me/share/url");
  });
});
