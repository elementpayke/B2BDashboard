import { describe, it, expect } from "vitest";
import {
  TERMINAL_ORDER_STATUSES,
  isTerminalOrderStatus,
  isPollingHaltStatus,
  nextPollIntervalMs,
} from "./useOrderStatus";

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

  it("halts on frozen even though frozen isn't terminal", () => {
    expect(isPollingHaltStatus("frozen")).toBe(true);
  });

  it("keeps polling while processing", () => {
    expect(isPollingHaltStatus("processing")).toBe(false);
  });

  it("keeps polling on an unrecognized status rather than halting silently", () => {
    expect(isPollingHaltStatus("some_future_status")).toBe(false);
  });
});

describe("nextPollIntervalMs", () => {
  it("starts at the base interval on the first attempt", () => {
    expect(nextPollIntervalMs(1)).toBe(2_000);
  });

  it("doubles each attempt", () => {
    expect(nextPollIntervalMs(2)).toBe(4_000);
    expect(nextPollIntervalMs(3)).toBe(8_000);
    expect(nextPollIntervalMs(4)).toBe(16_000);
  });

  it("caps at the max interval", () => {
    expect(nextPollIntervalMs(5)).toBe(30_000);
    expect(nextPollIntervalMs(10)).toBe(30_000);
  });

  it("treats attempt 0 (or negative) as the base interval, never zero", () => {
    expect(nextPollIntervalMs(0)).toBe(2_000);
    expect(nextPollIntervalMs(-1)).toBe(2_000);
  });

  it("honors custom base/max options", () => {
    expect(nextPollIntervalMs(1, { baseMs: 1_000, maxMs: 5_000 })).toBe(1_000);
    expect(nextPollIntervalMs(3, { baseMs: 1_000, maxMs: 5_000 })).toBe(4_000);
    expect(nextPollIntervalMs(4, { baseMs: 1_000, maxMs: 5_000 })).toBe(5_000);
  });
});
