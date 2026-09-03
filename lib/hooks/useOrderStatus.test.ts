import { describe, it, expect } from "vitest";
import {
  TERMINAL_ORDER_STATUSES,
  isTerminalOrderStatus,
  isPollingHaltStatus,
} from "@/lib/services/orderStatus";
import { nextPollIntervalMs, FROZEN_POLL_MS } from "@/lib/orderStatusPolling";

describe("isTerminalOrderStatus", () => {
  it("treats completed/failed/refunded/canceled as terminal", () => {
    for (const status of TERMINAL_ORDER_STATUSES) {
      expect(isTerminalOrderStatus(status)).toBe(true);
    }
  });

  it("does not treat processing as terminal", () => {
    expect(isTerminalOrderStatus("processing")).toBe(false);
  });

  it("does not treat frozen as terminal", () => {
    // Frozen requires manual review — Mboka's transition table still lets a
    // frozen order later resolve to processing/completed/failed, so it must
    // never be conflated with a settled outcome.
    expect(isTerminalOrderStatus("frozen")).toBe(false);
  });

  it("handles null/undefined/unknown values defensively", () => {
    expect(isTerminalOrderStatus(null)).toBe(false);
    expect(isTerminalOrderStatus(undefined)).toBe(false);
    expect(isTerminalOrderStatus("some_future_status")).toBe(false);
  });
});

describe("isPollingHaltStatus", () => {
  it("halts on every terminal status", () => {
    for (const status of TERMINAL_ORDER_STATUSES) {
      expect(isPollingHaltStatus(status)).toBe(true);
    }
  });

  it("keeps polling on frozen so a later resolution is picked up", () => {
    expect(isPollingHaltStatus("frozen")).toBe(false);
  });

  it("keeps polling while processing", () => {
    expect(isPollingHaltStatus("processing")).toBe(false);
  });

  it("keeps polling on an unrecognized status rather than halting silently", () => {
    expect(isPollingHaltStatus("some_future_status")).toBe(false);
  });
});

describe("nextPollIntervalMs", () => {
  it("starts at the fast interval on the first attempt", () => {
    expect(nextPollIntervalMs(1)).toBe(1_000);
  });

  it("stays fast through the first tier", () => {
    expect(nextPollIntervalMs(30)).toBe(1_000);
  });

  it("uses the medium interval in the second tier", () => {
    expect(nextPollIntervalMs(31)).toBe(2_000);
    expect(nextPollIntervalMs(60)).toBe(2_000);
  });

  it("caps at the max interval after the medium tier", () => {
    expect(nextPollIntervalMs(61)).toBe(5_000);
    expect(nextPollIntervalMs(100)).toBe(5_000);
  });

  it("treats attempt 0 (or negative) as the fast interval, never zero", () => {
    expect(nextPollIntervalMs(0)).toBe(1_000);
    expect(nextPollIntervalMs(-1)).toBe(1_000);
  });

  it("honors custom tier options", () => {
    expect(nextPollIntervalMs(1, { fastMs: 500, mediumMs: 1_000, maxMs: 3_000, fastUntil: 2, mediumUntil: 4 })).toBe(500);
    expect(nextPollIntervalMs(3, { fastMs: 500, mediumMs: 1_000, maxMs: 3_000, fastUntil: 2, mediumUntil: 4 })).toBe(1_000);
    expect(nextPollIntervalMs(5, { fastMs: 500, mediumMs: 1_000, maxMs: 3_000, fastUntil: 2, mediumUntil: 4 })).toBe(3_000);
  });

  it("exposes a slower frozen poll interval constant", () => {
    expect(FROZEN_POLL_MS).toBe(10_000);
  });
});
