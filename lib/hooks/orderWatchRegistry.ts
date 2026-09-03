"use client";

import { useSyncExternalStore } from "react";

export type OrderWatchEntry = {
  id: number;
  registeredAt: number;
};

/** Keep watching recent in-flight orders after modals close (30 minutes). */
export const ORDER_WATCH_TTL_MS = 30 * 60 * 1000;

const listeners = new Set<() => void>();
const entries = new Map<number, OrderWatchEntry>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

function pruneExpired(now = Date.now()): void {
  for (const [id, entry] of entries) {
    if (now - entry.registeredAt > ORDER_WATCH_TTL_MS) {
      entries.delete(id);
    }
  }
}

function snapshotEntries(): OrderWatchEntry[] {
  pruneExpired();
  return [...entries.values()].sort((a, b) => b.registeredAt - a.registeredAt);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Track a merchant order until it settles or the TTL expires. */
export function registerOrderWatch(id: number | string | null | undefined): void {
  if (id == null) return;
  const numericId = typeof id === "number" ? id : Number(id);
  if (!Number.isFinite(numericId)) return;
  entries.set(numericId, { id: numericId, registeredAt: Date.now() });
  emit();
}

/** Drop an order from the background watch list once it is settled. */
export function unregisterOrderWatch(id: number | string | null | undefined): void {
  if (id == null) return;
  const numericId = typeof id === "number" ? id : Number(id);
  if (!Number.isFinite(numericId)) return;
  if (!entries.delete(numericId)) return;
  emit();
}

export function getOrderWatchIds(): number[] {
  return snapshotEntries().map((entry) => entry.id);
}

export function useOrderWatchIds(): number[] {
  const entries = useSyncExternalStore(subscribe, snapshotEntries, snapshotEntries);
  return entries.map((entry) => entry.id);
}

/** Stable comma-separated key for EffectSource dependency arrays. */
export function useOrderWatchIdsKey(): string {
  const ids = useOrderWatchIds();
  return ids.join(",");
}
