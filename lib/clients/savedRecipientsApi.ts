"use client";

/**
 * Browser client for saved recipients.
 * Account numbers stay on the server. A transport failure is surfaced to the UI.
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

export async function listSavedRecipients(): Promise<SavedRecipient[]> {
  const data = await authEnvelope<SavedRecipientList>("GET", "/api/saved-recipients");
  return data?.items ?? [];
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
  return authEnvelope<SavedRecipient>("POST", "/api/saved-recipients", body);
}

export function formatSavedRecipientSubtitle(r: SavedRecipient): string {
  return formatSavedRecipientSummary(r);
}
