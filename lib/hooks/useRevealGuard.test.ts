import { describe, expect, it } from "vitest";
import { createRevealGuard } from "./useRevealGuard";

describe("createRevealGuard", () => {
  it("keeps an undisturbed reveal valid", () => {
    const guard = createRevealGuard();
    const isStale = guard.begin("card_1");
    expect(isStale()).toBe(false);
  });

  it("strands a reveal that was invalidated mid-flight", () => {
    const guard = createRevealGuard();
    const isStale = guard.begin("card_1");

    guard.invalidate("card_1");

    // The user hid the card while the request was out — its PAN/CVV must not
    // be written when it lands.
    expect(isStale()).toBe(true);
  });

  it("strands the first reveal across hide → show", () => {
    const guard = createRevealGuard();
    const first = guard.begin("card_1");

    guard.invalidate("card_1"); // hide
    const second = guard.begin("card_1"); // show again

    // The abandoned request must not satisfy the second request.
    expect(first()).toBe(true);
    expect(second()).toBe(false);
  });

  it("isolates keys from each other", () => {
    const guard = createRevealGuard();
    const one = guard.begin("card_1");
    const two = guard.begin("card_2");

    guard.invalidate("card_1");

    expect(one()).toBe(true);
    expect(two()).toBe(false);
  });

  it("invalidateAll strands every in-flight reveal", () => {
    const guard = createRevealGuard();
    const one = guard.begin("card_1");
    const two = guard.begin("card_2");

    guard.invalidateAll();

    expect(one()).toBe(true);
    expect(two()).toBe(true);
  });

  it("invalidateAll reaches a reveal never invalidated before", () => {
    // Regression: if begin() did not record the key, invalidateAll() would
    // skip it and a navigation would leave the response free to land.
    const guard = createRevealGuard();
    const isStale = guard.begin("card_1");

    guard.invalidateAll();

    expect(isStale()).toBe(true);
  });

  it("lets a reveal started after invalidateAll succeed", () => {
    const guard = createRevealGuard();
    guard.begin("card_1");
    guard.invalidateAll();

    const fresh = guard.begin("card_1");

    expect(fresh()).toBe(false);
  });

  it("stays stale after repeated invalidation", () => {
    const guard = createRevealGuard();
    const isStale = guard.begin("card_1");

    guard.invalidate("card_1");
    guard.invalidate("card_1");

    expect(isStale()).toBe(true);
  });

  it("invalidating an unknown key is harmless", () => {
    const guard = createRevealGuard();
    guard.invalidate("never_seen");

    const isStale = guard.begin("never_seen");

    expect(isStale()).toBe(false);
  });

  it("invalidateAll on an empty guard is harmless", () => {
    const guard = createRevealGuard();
    expect(() => guard.invalidateAll()).not.toThrow();
  });
});
