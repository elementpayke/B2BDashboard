/**
 * UI-facing client for saved send recipients.
 *
 * Talks to dashboard BFF `/api/saved-recipients` (envelope + session cookies).
 * Falls back to localStorage when the API is unavailable so Send UI can ship
 * before/without a live session. Canonical types & validation live in
 * `lib/services/savedRecipients.ts` — see `docs/saved-recipients.md`.
 */

import {
  savedRecipientsApi,
  type RailType,
  type SavedRecipient as ApiSavedRecipient,
  type SavedRecipientCreate,
} from "@/lib/services/savedRecipients";
import { ApiRequestError, isSessionExpiredError } from "@/lib/apiClient";

export type SavedRecipientRail = RailType;

/** UI shape used by SendModal / DashboardApp (name/account/rail). */
export type SavedRecipient = {
  id: string;
  /** Display name / account holder */
  name: string;
  /** Account number, phone, or wallet address */
  account: string;
  rail: SavedRecipientRail;
  countryCode?: string;
  countryName?: string;
  currency?: string;
  provider?: string;
  network?: string;
  createdAt: string;
};

export type SaveRecipientInput = {
  name: string;
  account: string;
  rail: SavedRecipientRail;
  countryCode?: string;
  countryName?: string;
  currency?: string;
  provider?: string;
  network?: string;
};

const STORAGE_KEY = "ep.savedRecipients.v1";

const DEMO_SEED: SavedRecipient[] = [
  {
    id: "demo-ke-equity",
    name: "Jane Mukami",
    account: "0100234567",
    rail: "bank",
    countryCode: "KE",
    countryName: "Kenya",
    currency: "KES",
    provider: "Equity Bank",
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "demo-ke-mpesa",
    name: "Wanjiru Njeri",
    account: "0712345678",
    rail: "mobile",
    countryCode: "KE",
    countryName: "Kenya",
    currency: "KES",
    provider: "M-Pesa",
    createdAt: "2026-01-02T00:00:00.000Z",
  },
];

function readLocal(): SavedRecipient[] {
  if (typeof window === "undefined") return [...DEMO_SEED];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(DEMO_SEED));
      return [...DEMO_SEED];
    }
    const parsed = JSON.parse(raw) as SavedRecipient[];
    return Array.isArray(parsed) ? parsed : [...DEMO_SEED];
  } catch {
    return [...DEMO_SEED];
  }
}

function writeLocal(list: SavedRecipient[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* ignore quota */
  }
}

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `sr_${Date.now().toString(36)}`;
}

/** Map BFF record → UI field names. */
export function fromApiSavedRecipient(r: ApiSavedRecipient): SavedRecipient {
  return {
    id: r.id,
    name: r.label,
    account: r.accountNumber,
    rail: r.railType,
    countryCode: r.countryCode ?? undefined,
    currency: r.currency ?? undefined,
    provider: r.provider ?? undefined,
    network: r.network ?? undefined,
    createdAt: r.createdAt,
  };
}

export function toApiCreateInput(input: SaveRecipientInput): SavedRecipientCreate {
  return {
    label: input.name.trim(),
    accountNumber: input.account.trim(),
    railType: input.rail,
    countryCode: input.countryCode,
    currency: input.currency,
    provider: input.provider,
    network: input.network,
  };
}

export async function listSavedRecipients(): Promise<SavedRecipient[]> {
  try {
    const list = await savedRecipientsApi.list();
    return list.items.map(fromApiSavedRecipient);
  } catch (err) {
    if (isSessionExpiredError(err)) throw err;
    // Unauthenticated / missing route / 5xx → local demo list for UI.
    if (err instanceof ApiRequestError && (err.status === 401 || err.status === 403)) {
      return readLocal();
    }
    return readLocal();
  }
}

export async function createSavedRecipient(input: SaveRecipientInput): Promise<SavedRecipient> {
  const payload = toApiCreateInput(input);

  try {
    const created = await savedRecipientsApi.create(payload);
    return fromApiSavedRecipient(created);
  } catch (err) {
    if (isSessionExpiredError(err)) throw err;
    /* fall through to local */
  }

  const saved: SavedRecipient = {
    id: newId(),
    name: payload.label,
    account: payload.accountNumber,
    rail: payload.railType,
    countryCode: input.countryCode,
    countryName: input.countryName,
    currency: input.currency,
    provider: input.provider,
    network: input.network,
    createdAt: new Date().toISOString(),
  };
  const next = [saved, ...readLocal().filter((r) => r.id !== saved.id)];
  writeLocal(next);
  return saved;
}

export async function deleteSavedRecipient(id: string): Promise<void> {
  try {
    await savedRecipientsApi.remove(id);
  } catch (err) {
    if (isSessionExpiredError(err)) throw err;
    writeLocal(readLocal().filter((r) => r.id !== id));
  }
}

export function formatSavedRecipientSubtitle(r: SavedRecipient): string {
  const parts = [
    r.provider || (r.rail === "crypto" ? r.network : r.rail),
    r.account ? `···${r.account.slice(-4)}` : null,
  ].filter(Boolean);
  return parts.join(" · ");
}
