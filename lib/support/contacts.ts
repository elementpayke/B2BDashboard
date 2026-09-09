/** Public support channels shown in the Help modal (not admin inboxes). */

export const SUPPORT_EMAIL = "info@elementpay.net";

/** Display form with spaces. */
export const SUPPORT_WHATSAPP_DISPLAY = "+254 720 752314";

/** Digits only for wa.me links. */
export const SUPPORT_WHATSAPP_E164 = "254720752314";

export function supportMailtoHref(subject?: string, body?: string): string {
  const params = new URLSearchParams();
  if (subject?.trim()) params.set("subject", subject.trim());
  if (body?.trim()) params.set("body", body.trim());
  const qs = params.toString();
  return qs ? `mailto:${SUPPORT_EMAIL}?${qs}` : `mailto:${SUPPORT_EMAIL}`;
}

export function supportWhatsAppHref(prefill?: string): string {
  const text = (prefill || "").trim();
  if (!text) return `https://wa.me/${SUPPORT_WHATSAPP_E164}`;
  return `https://wa.me/${SUPPORT_WHATSAPP_E164}?text=${encodeURIComponent(text)}`;
}
