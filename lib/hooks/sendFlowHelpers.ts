/**
 * Thin pure helpers for the Send modal UI.
 * Track 0: extraction only — no new backend wiring.
 */

export type SendDestinationInput = {
  sendGroup: string;
  sendAsset: string;
  sendChainLabel: string;
  countryName: string;
  providerName: string;
};

/** Summary line shown on send steps 2–3 for the chosen destination. */
export function buildSendDestinationSummary(input: SendDestinationInput): string {
  if (input.sendGroup === "crypto") {
    return `${input.sendAsset.toUpperCase()} · ${input.sendChainLabel}`;
  }
  return `${input.countryName} · ${input.providerName}`;
}

export function buildSendStepDots(sendStep: number, total = 3): { on: boolean }[] {
  return Array.from({ length: total }, (_, i) => ({ on: i + 1 <= sendStep }));
}
