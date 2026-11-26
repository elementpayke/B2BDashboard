/**
 * Onboarding funnel events. No analytics provider is wired yet, so an event
 * is announced two ways a provider can pick up without touching call sites:
 * a `mboka:track` window event, and a push to a tag-manager `dataLayer` when
 * the page has one.
 *
 * Properties are limited to short plain values (numbers, booleans, strings up
 * to 64 characters), so names, emails, ID numbers or documents can't be sent
 * by accident. Pass field names and statuses, never what the user typed.
 */
export type FunnelEvent =
  | "signup_completed"
  | "email_verified"
  | "kyb_wizard_opened"
  | "kyb_step_completed"
  | "kyb_validation_failed"
  | "kyb_save_failed"
  | "kyb_document_uploaded"
  | "kyb_document_failed"
  | "kyb_submitted"
  | "kyb_status_changed"
  | "kyb_gate_shown"
  | "get_started_clicked";

type Plain = string | number | boolean | null | undefined;

const MAX_STRING = 64;

function clean(props: Record<string, Plain> | undefined): Record<string, string | number | boolean | null> {
  const out: Record<string, string | number | boolean | null> = {};
  if (!props) return out;
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined) continue;
    if (value === null || typeof value === "number" || typeof value === "boolean") {
      out[key] = value;
    } else if (typeof value === "string" && value.length <= MAX_STRING) {
      out[key] = value;
    }
  }
  return out;
}

export function track(event: FunnelEvent, props?: Record<string, Plain>): void {
  if (typeof window === "undefined") return;
  try {
    const payload = { event, ...clean(props), at: new Date().toISOString() };
    window.dispatchEvent(new CustomEvent("mboka:track", { detail: payload }));
    const layer = (window as { dataLayer?: unknown }).dataLayer;
    if (Array.isArray(layer)) layer.push(payload);
  } catch {
    // Analytics must never break the product.
  }
}
