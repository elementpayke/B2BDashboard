// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { track } from "./track";

afterEach(() => {
  delete (window as { dataLayer?: unknown[] }).dataLayer;
});

describe("track", () => {
  it("announces the event for whichever provider listens", () => {
    const seen = vi.fn();
    window.addEventListener("mboka:track", seen as EventListener);
    track("kyb_step_completed", { step: 1 });
    window.removeEventListener("mboka:track", seen as EventListener);
    const detail = (seen.mock.calls[0][0] as CustomEvent).detail;
    expect(detail).toMatchObject({ event: "kyb_step_completed", step: 1 });
    expect(typeof detail.at).toBe("string");
  });

  it("pushes to a tag manager data layer when the page has one", () => {
    (window as { dataLayer?: unknown[] }).dataLayer = [];
    track("kyb_gate_shown", { action: "send", status: "pending" });
    expect((window as { dataLayer?: unknown[] }).dataLayer).toEqual([
      expect.objectContaining({ event: "kyb_gate_shown", action: "send", status: "pending" }),
    ]);
  });

  it("drops anything that isn't a short plain value, so personal data can't ride along", () => {
    const seen = vi.fn();
    window.addEventListener("mboka:track", seen as EventListener);
    track("kyb_validation_failed", {
      step: 2,
      field: "associates.0.email",
      nested: { email: "a@b.co" } as never,
      long: "x".repeat(200),
    });
    window.removeEventListener("mboka:track", seen as EventListener);
    const detail = (seen.mock.calls[0][0] as CustomEvent).detail;
    expect(detail).toMatchObject({ step: 2, field: "associates.0.email" });
    expect(detail).not.toHaveProperty("nested");
    expect(detail).not.toHaveProperty("long");
  });

  it("never throws", () => {
    (window as { dataLayer?: unknown }).dataLayer = "not an array";
    expect(() => track("kyb_submitted")).not.toThrow();
  });
});
