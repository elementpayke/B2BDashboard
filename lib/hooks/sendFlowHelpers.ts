/**
 * Thin pure helpers for the Send modal UI.
 * Track 0: extraction only — no new backend wiring.
 */

export type SendDestinationInput = {
  sendGroup: string;
  sendAsset: string;
  sendChainLabel: string;
  countryName: string;
  /** Brand-neutral channel label (e.g. "Mobile money"), never a partner name. */
  channelLabel: string;
};

/** Summary line shown on send steps 2–3 for the chosen destination. */
export function buildSendDestinationSummary(input: SendDestinationInput): string {
  if (input.sendGroup === "crypto") {
    return `${input.sendAsset.toUpperCase()} · ${input.sendChainLabel}`;
  }
  return `${input.countryName} · ${input.channelLabel}`;
}

export function buildSendStepDots(sendStep: number, total = 3): { on: boolean }[] {
  return Array.from({ length: total }, (_, i) => ({ on: i + 1 <= sendStep }));
}

/**
 * Whether this corridor can actually be quoted.
 *
 * Both country rails require `destination.networkId` — the aggregator's
 * institution id, which only comes from `GET /v1/supported/catalog`. The
 * backend rejects the quote on its own validation without it
 * ("payment_method.network_id is required for this rail"), for `bank` and
 * `momo` account types alike, so when the catalog is unavailable there is no
 * payload that can succeed.
 *
 * `providerNamesFromCatalog` still falls back to a hardcoded display list in
 * that case, which is fine for rendering the corridor but cannot carry an id
 * — so the flow has to stop at step 1 rather than let someone fill in a
 * recipient and an amount and only fail at the quote.
 */
export function sendRailBlockedByMissingNetworkId(input: {
  sendGroup: string;
  /** Result of networkIdForProvider for the selected provider. */
  networkId: string | undefined;
  /** False while the first catalog fetch is still in flight. */
  catalogSettled: boolean;
}): boolean {
  if (input.sendGroup !== "country") return false;
  if (!input.catalogSettled) return false;
  return !input.networkId;
}

/**
 * Human copy for the quote failures whose raw backend message is a field
 * path or an internal integration detail. Everything else passes through —
 * the backend's own wording is usually better than a substitute.
 */
export function friendlySendQuoteError(message: string): string {
  if (/network_id is required/i.test(message)) {
    return "This corridor can't be priced right now — our provider list is unavailable, so we can't route the payment. Please try again shortly.";
  }
  if (/invalid or revoked api key|aggregator returned 401/i.test(message)) {
    return "Payouts are temporarily unavailable — our payment partner rejected the connection. This is on us, not your details.";
  }
  return message;
}

/** The four entry points on the Send method chooser. `internal` has no
 *  backend yet, so it is presented disabled rather than omitted. */
export type SendMethod = "bank" | "mobile" | "crypto" | "internal";

/**
 * Rail index implied by the chosen send method for a given country.
 *
 * Picking "Bank transfer" or "Mobile money" answers the rail question up
 * front, so the flow preselects that rail instead of asking again in step 1.
 * Countries with no rail of that type (South Africa has no mobile money rail)
 * fall back to the first available rail.
 */
export function railIndexForMethod(
  rails: { type: string }[] | undefined,
  method: SendMethod | null,
): number {
  if (!rails || rails.length === 0) return 0;
  const wanted = method === "mobile" ? "mobile" : method === "bank" ? "bank" : null;
  if (!wanted) return 0;
  const idx = rails.findIndex((r) => r.type === wanted);
  return idx < 0 ? 0 : idx;
}

/**
 * Whether step 1 should still offer a payout-rail choice.
 *
 * It should not when the method chooser already fixed the rail — that would
 * ask the same question twice. But "fixed" only holds if the country actually
 * offers a rail of that type: pick Mobile money, then South Africa, and
 * `railIndexForMethod` falls back to the bank rail. Hiding the picker there
 * would silently turn a mobile-money send into a bank transfer with nothing
 * on screen saying so, so the picker stays visible in that case.
 */
export function sendRailHasChoice(
  rails: { type: string }[] | undefined,
  method: SendMethod | null,
): boolean {
  if (!rails || rails.length <= 1) return false;
  const wanted = method === "mobile" ? "mobile" : method === "bank" ? "bank" : null;
  if (!wanted) return true;
  return !rails.some((r) => r.type === wanted);
}
