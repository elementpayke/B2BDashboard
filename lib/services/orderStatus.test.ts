import { describe, it, expect } from "vitest";
import {
  isPollingHaltStatus,
  isTerminalOrderStatus,
  TERMINAL_ORDER_STATUSES,
} from "./orderStatus";

describe("orderStatus", () => {
  it("treats completed/failed/refunded/canceled as terminal", () => {
    for (const status of TERMINAL_ORDER_STATUSES) {
      expect(isTerminalOrderStatus(status)).toBe(true);
    }
  });

  it("does not halt polling on frozen", () => {
    expect(isPollingHaltStatus("frozen")).toBe(false);
  });
});
