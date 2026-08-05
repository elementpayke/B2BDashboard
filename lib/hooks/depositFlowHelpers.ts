/**
 * Thin pure helpers for the Deposit / Receive modal UI.
 */

export type DepositDestinationInput = {
  depositGroup: string;
  depositAsset: string;
  depositNetworkLabel: string;
  countryName: string;
  providerName: string;
};

/** Summary line shown on deposit steps 2–3 for the chosen corridor. */
export function buildDepositDestinationSummary(input: DepositDestinationInput): string {
  if (input.depositGroup === "crypto") {
    return `${input.depositAsset.toUpperCase()} · ${input.depositNetworkLabel}`;
  }
  return `${input.countryName} · ${input.providerName}`;
}

export function buildDepositStepDots(depositStep: number, total = 3): { on: boolean }[] {
  return Array.from({ length: total }, (_, i) => ({ on: i + 1 <= depositStep }));
}
