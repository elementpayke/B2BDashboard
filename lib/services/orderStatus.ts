import type { OrderStatus } from "./orders";
import { isTerminalTransactionStatus } from "./transactionStatus";

// Mirrors Mboka's TERMINAL_STATUSES (app/services/orders/status.py).
export const TERMINAL_ORDER_STATUSES: readonly OrderStatus[] = [
  "completed",
  "failed",
  "refunded",
  "canceled",
];

/** True for the 4 statuses the backend will never transition out of. */
export function isTerminalOrderStatus(status: string | null | undefined): status is OrderStatus {
  if (!status) return false;
  return (
    (TERMINAL_ORDER_STATUSES as readonly string[]).includes(status) &&
    isTerminalTransactionStatus(status as OrderStatus)
  );
}

/**
 * True when fast order polling should stop. Only terminal statuses halt;
 * `frozen` keeps polling (slowly) because Mboka can still resolve it later.
 */
export function isPollingHaltStatus(status: string | null | undefined): boolean {
  return isTerminalOrderStatus(status);
}
