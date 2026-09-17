// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CARD_SECRET_TTL_MS, useSecretExpiry } from "./useSecretExpiry";

describe("useSecretExpiry", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("expires a key after the ttl", () => {
    const onExpire = vi.fn();
    renderHook(() => useSecretExpiry(["card_1"], onExpire, 1000));

    expect(onExpire).not.toHaveBeenCalled();
    act(() => void vi.advanceTimersByTime(1000));

    expect(onExpire).toHaveBeenCalledExactlyOnceWith("card_1");
  });

  it("does not expire early", () => {
    const onExpire = vi.fn();
    renderHook(() => useSecretExpiry(["card_1"], onExpire, 1000));

    act(() => void vi.advanceTimersByTime(999));

    expect(onExpire).not.toHaveBeenCalled();
  });

  it("gives each key its own independent window", () => {
    const onExpire = vi.fn();
    const { rerender } = renderHook(
      ({ keys }) => useSecretExpiry(keys, onExpire, 1000),
      { initialProps: { keys: ["card_1"] } },
    );

    act(() => void vi.advanceTimersByTime(600));
    rerender({ keys: ["card_1", "card_2"] });
    act(() => void vi.advanceTimersByTime(400));

    // Revealing a second card must not extend the first card's exposure.
    expect(onExpire).toHaveBeenCalledExactlyOnceWith("card_1");

    act(() => void vi.advanceTimersByTime(600));
    expect(onExpire).toHaveBeenCalledTimes(2);
    expect(onExpire).toHaveBeenLastCalledWith("card_2");
  });

  it("does not restart a running timer when the callback identity changes", () => {
    let onExpire = vi.fn();
    const { rerender } = renderHook(
      ({ cb }) => useSecretExpiry(["card_1"], cb, 1000),
      { initialProps: { cb: onExpire } },
    );

    act(() => void vi.advanceTimersByTime(900));
    // A parent re-render hands down a fresh closure every time; that must not
    // buy the secret another full window.
    onExpire = vi.fn();
    rerender({ cb: onExpire });
    act(() => void vi.advanceTimersByTime(100));

    expect(onExpire).toHaveBeenCalledExactlyOnceWith("card_1");
  });

  it("does not re-arm a key that is still present after firing", () => {
    const onExpire = vi.fn();
    const { rerender } = renderHook(
      ({ keys }) => useSecretExpiry(keys, onExpire, 1000),
      { initialProps: { keys: ["card_1"] } },
    );

    act(() => void vi.advanceTimersByTime(1000));
    rerender({ keys: ["card_1"] });
    act(() => void vi.advanceTimersByTime(5000));

    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it("drops the timer when a key disappears", () => {
    const onExpire = vi.fn();
    const { rerender } = renderHook(
      ({ keys }) => useSecretExpiry(keys, onExpire, 1000),
      { initialProps: { keys: ["card_1"] } },
    );

    act(() => void vi.advanceTimersByTime(500));
    rerender({ keys: [] });
    act(() => void vi.advanceTimersByTime(5000));

    // Manually hidden already — firing later would slam a card the user
    // may have deliberately re-opened.
    expect(onExpire).not.toHaveBeenCalled();
  });

  it("restarts the window when a key is revealed again", () => {
    const onExpire = vi.fn();
    const { rerender } = renderHook(
      ({ keys }) => useSecretExpiry(keys, onExpire, 1000),
      { initialProps: { keys: ["card_1"] } },
    );

    act(() => void vi.advanceTimersByTime(900));
    rerender({ keys: [] });
    rerender({ keys: ["card_1"] });
    act(() => void vi.advanceTimersByTime(900));
    expect(onExpire).not.toHaveBeenCalled();

    act(() => void vi.advanceTimersByTime(100));
    expect(onExpire).toHaveBeenCalledExactlyOnceWith("card_1");
  });

  it("clears pending timers on unmount", () => {
    const onExpire = vi.fn();
    const { unmount } = renderHook(() =>
      useSecretExpiry(["card_1"], onExpire, 1000),
    );

    unmount();
    act(() => void vi.advanceTimersByTime(5000));

    expect(onExpire).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("no-ops with no keys", () => {
    const onExpire = vi.fn();
    renderHook(() => useSecretExpiry([], onExpire, 1000));

    act(() => void vi.advanceTimersByTime(5000));

    expect(onExpire).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("defaults to a one-minute window", () => {
    expect(CARD_SECRET_TTL_MS).toBe(60_000);

    const onExpire = vi.fn();
    renderHook(() => useSecretExpiry(["card_1"], onExpire));

    act(() => void vi.advanceTimersByTime(CARD_SECRET_TTL_MS - 1));
    expect(onExpire).not.toHaveBeenCalled();

    act(() => void vi.advanceTimersByTime(1));
    expect(onExpire).toHaveBeenCalledExactlyOnceWith("card_1");
  });
});
