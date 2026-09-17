"use client";

import { useEffect, useRef } from "react";

/**
 * How long revealed card credentials stay on screen before auto-hiding.
 *
 * Long enough to hand-type PAN + expiry + CVV into a checkout form, short
 * enough that an unattended or screen-shared tab doesn't sit exposed.
 */
export const CARD_SECRET_TTL_MS = 60_000;

/**
 * Call `onExpire(key)` once, `ttlMs` after a key first appears in `keys`.
 *
 * Deliberately per-key and non-restarting: revealing a second card must not
 * extend the first card's exposure window, which is what a single shared
 * timer (or one re-armed on every render) would do.
 *
 * Keys that disappear have their pending timer dropped — the secret is
 * already gone, so firing later would hide a card the user just re-opened.
 */
export function useSecretExpiry(
  keys: string[],
  onExpire: (key: string) => void,
  ttlMs: number = CARD_SECRET_TTL_MS,
): void {
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Held in a ref so a new callback identity each render doesn't reschedule
  // (and therefore extend) timers that are already counting down.
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  // NUL delimiter so the fingerprint cannot collide for ids that contain
  // the separator. Written as an escape — a literal control byte in the
  // source makes git treat the whole file as binary.
  const fingerprint = keys.join("\u0000");

  useEffect(() => {
    const pending = timers.current;
    const active = new Set(keys);

    for (const key of active) {
      if (pending.has(key)) continue;
      pending.set(
        key,
        setTimeout(() => {
          pending.delete(key);
          onExpireRef.current(key);
        }, ttlMs),
      );
    }

    for (const [key, handle] of pending) {
      if (active.has(key)) continue;
      clearTimeout(handle);
      pending.delete(key);
    }
    // `keys` is rebuilt each render; `fingerprint` is its stable identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fingerprint, ttlMs]);

  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const handle of pending.values()) clearTimeout(handle);
      pending.clear();
    };
  }, []);
}
