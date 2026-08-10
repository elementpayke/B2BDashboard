"use client";

/**
 * Browser client for saved recipients.
 * Prefers `/api/saved-recipients`; falls back to localStorage only when the
 * request never reaches a responding BFF (network / offline). Server and
 * auth errors are rethrown so the UI can surface them.
 */

import {
  ApiRequestError,
  SessionExpiredError,
  authEnvelope,
} from "@/lib/apiClient";
import {
  formatSavedRecipientSummary,
  type RailType,
  type SavedRecipient,
  type SavedRecipientCreate,
  type SavedRecipientList,
} from "@/lib/services/savedRecipients";

export type { RailType, SavedRecipient };
export type SavedRecipientRail = RailType;

const STORAGE_KEY = "ep.savedRecipients.v1";

function readLocal(): SavedRecipient[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedRecipient[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
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

/** True when the BFF never answered (offline / CORS / aborted) — not 4xx/5xx. */
function isTransportFailure(err: unknown): boolean {
  if (err instanceof SessionExpiredError || err instanceof ApiRequestError) {
    return false;
  }
  return true;
}

export async function listSavedRecipients(): Promise<SavedRecipient[]> {
  try {
    const data = await authEnvelope<SavedRecipientList>("GET", "/api/saved-recipients");
    if (data?.items) return data.items;
    return [];
  } catch (err) {
    if (!isTransportFailure(err)) throw err;
    return readLocal();
  }
}

export type SaveRecipientInput = {
  name: string;
  account: string;
  rail: RailType;
  countryCode?: string;
  countryName?: string;
  currency?: string;
  provider?: string;
  network?: string;
};

export async function createSavedRecipient(input: SaveRecipientInput): Promise<SavedRecipient> {
  const body: SavedRecipientCreate = {
    label: input.name.trim(),
    accountNumber: input.account.trim(),
    railType: input.rail,
    countryCode: input.countryCode ?? null,
    currency: input.currency ?? null,
    provider: input.provider ?? null,
    network: input.network ?? null,
  };

  try {
    return await authEnvelope<SavedRecipient>("POST", "/api/saved-recipients", body);
  } catch (err) {
    if (!isTransportFailure(err)) throw err;
    const now = new Date().toISOString();
    const saved: SavedRecipient = {
      id: newId(),
      businessId: 0,
      label: body.label,
      accountNumber: body.accountNumber,
      railType: body.railType,
      countryCode: body.countryCode ?? null,
      currency: body.currency ?? null,
      provider: body.provider ?? null,
      network: body.network ?? null,
      createdAt: now,
      updatedAt: now,
    };
    writeLocal([saved, ...readLocal().filter((r) => r.id !== saved.id)]);
    return saved;
  }
}

export function formatSavedRecipientSubtitle(r: SavedRecipient): string {
  return formatSavedRecipientSummary(r);
}
