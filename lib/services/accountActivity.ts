"use client";

// Account lifecycle audit trail — Mboka ingests Nuvion's account webhooks
// (entities.*, accounts.*, account_details.*) server-side and translates
// them into white-labeled entries here. This dashboard only displays that
// log; it never receives or verifies a webhook itself (see the `webhooks/*`
// block in app/api/mboka/[...path]/route.ts).

import { apiEnvelope } from "@/lib/apiClient";

export type AccountActivityEntry = {
  /** Mboka's own stable identifier — never a raw Nuvion event name. */
  event_type: string;
  /** White-labeled, human-readable (e.g. "Bank details issued"). */
  label: string;
  occurred_at: string;
  detail?: string | null;
};

export type AccountActivityPage = {
  entries: AccountActivityEntry[];
  total: number;
  limit: number;
  offset: number;
};

export type AccountActivityListParams = {
  limit?: number;
  offset?: number;
};

function normalizeEntry(raw: unknown): AccountActivityEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const eventType = typeof r.event_type === "string" ? r.event_type.trim() : "";
  const label = typeof r.label === "string" ? r.label.trim() : "";
  const occurredAt = typeof r.occurred_at === "string" ? r.occurred_at.trim() : "";
  if (!eventType || !label || !occurredAt) return null;
  const detail = typeof r.detail === "string" && r.detail.trim() ? r.detail.trim() : null;
  return { event_type: eventType, label, occurred_at: occurredAt, detail };
}

/**
 * Fails closed per-entry (drops anything malformed) rather than throwing or
 * inventing fields — this is a backend contract that doesn't exist yet, so
 * a partial/unexpected shape must degrade to "fewer rows," never a crash.
 */
export function normalizeAccountActivityPage(
  raw: unknown,
  params: { limit: number; offset: number },
): AccountActivityPage {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const rawEntries = Array.isArray(r.entries) ? r.entries : [];
  const entries = rawEntries
    .map(normalizeEntry)
    .filter((e): e is AccountActivityEntry => e !== null);
  const total =
    typeof r.total === "number" && Number.isFinite(r.total) ? r.total : entries.length;
  return { entries, total, limit: params.limit, offset: params.offset };
}

export const accountActivityApi = {
  listPage: async (
    accountId: string,
    params: AccountActivityListParams = {},
  ): Promise<AccountActivityPage> => {
    const limit = params.limit ?? 20;
    const offset = params.offset ?? 0;
    const qs = new URLSearchParams();
    qs.set("limit", String(limit));
    qs.set("offset", String(offset));
    const raw = await apiEnvelope<unknown>(
      "GET",
      `/v1/iban/accounts/${encodeURIComponent(accountId)}/activity?${qs.toString()}`,
    );
    return normalizeAccountActivityPage(raw, { limit, offset });
  },
};
