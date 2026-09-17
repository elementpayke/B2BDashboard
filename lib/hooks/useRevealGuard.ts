"use client";

import { useRef } from "react";

/**
 * Generation guard for in-flight credential reveals.
 *
 * Hiding a card is not enough on its own: a reveal already in flight will still
 * resolve and write PAN/CVV into state after the user dismissed it. Checking
 * "is the tile currently face-up?" at write time is not equivalent either —
 * show → hide → show lands the *abandoned* request's payload and leaves the
 * user's second request unmade.
 *
 * So each reveal takes a generation at start and re-checks it at the end. Any
 * hide, close, or navigation bumps the generation, which strands the response
 * of every reveal that began before it.
 */
export type RevealGuard = {
  /**
   * Start a reveal for `key`. The returned predicate reports whether this
   * particular reveal has been abandoned since it began.
   */
  begin: (key: string) => () => boolean;
  /** Abandon any in-flight reveal for `key`. */
  invalidate: (key: string) => void;
  /** Abandon every in-flight reveal (navigation, sign-out). */
  invalidateAll: () => void;
};

export function createRevealGuard(): RevealGuard {
  const generations = new Map<string, number>();

  return {
    begin(key: string) {
      const started = generations.get(key) ?? 0;
      // Record the key even when unchanged, so invalidateAll() can reach a
      // reveal that is in flight but has never been invalidated before.
      generations.set(key, started);
      return () => (generations.get(key) ?? 0) !== started;
    },
    invalidate(key: string) {
      generations.set(key, (generations.get(key) ?? 0) + 1);
    },
    invalidateAll() {
      for (const [key, generation] of generations) {
        generations.set(key, generation + 1);
      }
    },
  };
}

/** Stable per-component reveal guard. */
export function useRevealGuard(): RevealGuard {
  const ref = useRef<RevealGuard | null>(null);
  if (ref.current === null) ref.current = createRevealGuard();
  return ref.current;
}
