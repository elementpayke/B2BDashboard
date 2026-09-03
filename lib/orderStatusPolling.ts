import { isPollingHaltStatus, isTerminalOrderStatus, TERMINAL_ORDER_STATUSES } from "@/lib/services/orderStatus";

export { TERMINAL_ORDER_STATUSES, isTerminalOrderStatus, isPollingHaltStatus };

const DEFAULT_FAST_MS = 1_000;
const DEFAULT_MEDIUM_MS = 2_000;
const DEFAULT_MAX_MS = 5_000;
/** Poll every second for the first ~30s after accept — when users watch the send success screen. */
const DEFAULT_FAST_UNTIL_ATTEMPT = 30;
/** Then every 2s for another minute before settling at the cap. */
const DEFAULT_MEDIUM_UNTIL_ATTEMPT = 60;
/** Manual-review orders still need updates, but less often than active processing. */
export const FROZEN_POLL_MS = 10_000;

/**
 * Tiered polling for order status: 1s → 2s → 5s cap (never 30s). OffRamp
 * corridors can take minutes; the old 2s→30s backoff meant users waited up
 * to half a minute between status checks late in the lifecycle.
 */
export function nextPollIntervalMs(
  attempt: number,
  opts: {
    fastMs?: number;
    mediumMs?: number;
    maxMs?: number;
    fastUntil?: number;
    mediumUntil?: number;
  } = {},
): number {
  const fastMs = opts.fastMs ?? DEFAULT_FAST_MS;
  const mediumMs = opts.mediumMs ?? DEFAULT_MEDIUM_MS;
  const maxMs = opts.maxMs ?? DEFAULT_MAX_MS;
  const fastUntil = opts.fastUntil ?? DEFAULT_FAST_UNTIL_ATTEMPT;
  const mediumUntil = opts.mediumUntil ?? DEFAULT_MEDIUM_UNTIL_ATTEMPT;
  if (attempt < 1) return fastMs;
  if (attempt <= fastUntil) return fastMs;
  if (attempt <= mediumUntil) return mediumMs;
  return maxMs;
}
