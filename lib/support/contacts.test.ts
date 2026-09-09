import { describe, expect, it } from "vitest";
import {
  SUPPORT_EMAIL,
  SUPPORT_WHATSAPP_E164,
  supportMailtoHref,
  supportWhatsAppHref,
} from "@/lib/support/contacts";
import { isSupportCategory } from "@/lib/services/support";

describe("support contacts", () => {
  it("builds mailto and WhatsApp links", () => {
    expect(SUPPORT_EMAIL).toBe("info@elementpay.net");
    expect(supportMailtoHref("Help")).toContain("mailto:info@elementpay.net");
    expect(supportWhatsAppHref("hi")).toContain(`wa.me/${SUPPORT_WHATSAPP_E164}`);
    expect(supportWhatsAppHref("hi")).toContain("text=hi");
  });
});

describe("support categories", () => {
  it("accepts known categories only", () => {
    expect(isSupportCategory("payout")).toBe(true);
    expect(isSupportCategory("nope")).toBe(false);
  });
});
