import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  getOrderWatchIds,
  registerOrderWatch,
  unregisterOrderWatch,
  ORDER_WATCH_TTL_MS,
} from "./orderWatchRegistry";

describe("orderWatchRegistry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-03T12:00:00Z"));
    for (const id of getOrderWatchIds()) {
      unregisterOrderWatch(id);
    }
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("registers and returns watched ids", () => {
    registerOrderWatch(42);
    expect(getOrderWatchIds()).toEqual([42]);
  });

  it("refreshes registration time for duplicate ids", () => {
    registerOrderWatch(7);
    vi.advanceTimersByTime(ORDER_WATCH_TTL_MS - 1_000);
    registerOrderWatch(7);
    vi.advanceTimersByTime(ORDER_WATCH_TTL_MS - 500);
    expect(getOrderWatchIds()).toEqual([7]);
  });

  it("prunes expired entries", () => {
    registerOrderWatch(9);
    vi.advanceTimersByTime(ORDER_WATCH_TTL_MS + 1);
    expect(getOrderWatchIds()).toEqual([]);
  });

  it("unregisters settled orders", () => {
    registerOrderWatch(3);
    unregisterOrderWatch(3);
    expect(getOrderWatchIds()).toEqual([]);
  });
});
