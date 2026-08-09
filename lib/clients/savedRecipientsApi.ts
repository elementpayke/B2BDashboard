"use client";

/**
 * Browser client for saved recipients.
 * Prefers `/api/saved-recipients`; falls back to localStorage when the API
 * is unavailable (offline / before deploy of the BFF routes).
 */

import { authEnvelope } from "@/lib/apiClient";
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

const DEMO_SEED: SavedRecipient[] = [
  {
    id: "demo-ke-equity",
    businessId: 0,
    label: "Jane Mukami",
    accountNumber: "0100234567",
    railType: "bank",
    countryCode: "KE",
    currency: "KES",
    provider: "Equity Bank",
    network: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "demo-ke-mpesa",
    businessId: 0,
    label: "Wanjiru Njeri",
    accountNumber: "0712345678",
    railType: "mobile",
    countryCode: "KE",
    currency: "KES",
    provider: "M-Pesa",
    network: null,
    createdAt: "2026-01-02T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
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

export async function listSavedRecipients(): Promise<SavedRecipient[]> {
  try {
    const data = await authEnvelope<SavedRecipientList>("GET", "/api/saved-recipients");
    if (data?.items) return data.items;
  } catch {
    /* fall back */
  }
  return readLocal();
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
  } catch {
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
