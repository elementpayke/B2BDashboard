import { apiEnvelope } from "@/lib/apiClient";

/** `GET /v1/entities` row (local ProviderEntity projection). */
export type ProviderEntity = {
  id: string;
  customer_ref: string | null;
  entity_type: string | null;
  status: string | null;
};

/**
 * Partner account shape is forward-compatible — ids and fields arrive under
 * several spellings depending on the aggregator version. Normalize to what
 * Phase 4 sends need: a ready USDC stablecoin account on Base or Polygon.
 */
export type FinancialAccount = {
  id: string;
  entityId: string;
  assetType: string;
  currency: string;
  network: string;
  status: string;
};

const READY = new Set(["active", "ready", "open", "opened"]);
const SEND_NETWORKS = new Set(["base", "polygon"]);

/** Body for `POST /v1/entities/{id}/accounts` (`AccountOpenIn`). */
export type AccountOpenPayload = {
  asset_type: "fiat" | "stablecoin";
  currency: string;
  network?: string | null;
  display_name?: string | null;
};

export const entitiesApi = {
  list: () => apiEnvelope<ProviderEntity[]>("GET", "/v1/entities"),
  listAccounts: (entityId: string) =>
    apiEnvelope<unknown>("GET", `/v1/entities/${encodeURIComponent(entityId)}/accounts`),
  openAccount: (entityId: string, payload: AccountOpenPayload) =>
    apiEnvelope<unknown>(
      "POST",
      `/v1/entities/${encodeURIComponent(entityId)}/accounts`,
      payload,
    ),
};

/** First linked partner entity, or a clear error when KYB/entity onboarding is incomplete. */
export async function resolvePrimaryEntityId(): Promise<string> {
  const entities = await entitiesApi.list();
  const id = Array.isArray(entities)
    ? entities.map((e) => e?.id?.trim()).find((value): value is string => Boolean(value))
    : undefined;
  if (!id) {
    throw new Error(
      "No partner entity linked — complete business verification before opening stablecoin accounts.",
    );
  }
  return id;
}

/**
 * Build a Phase 4–compatible open-account body from Create Account UI values.
 * UI network codes are `BASE` / `POLYGON`; partner expects `Base` / `Polygon`.
 */
export function buildStablecoinOpenPayload(input: {
  currency: string;
  network: string;
  displayName: string;
}): AccountOpenPayload {
  const currency = input.currency.trim().toUpperCase();
  if (currency !== "USDC") {
    throw new Error("Only USDC stablecoin accounts can be opened.");
  }
  const network = toPartnerNetwork(input.network);
  if (!network) {
    throw new Error("Choose Base or Polygon — other networks aren't supported yet.");
  }
  return {
    asset_type: "stablecoin",
    currency,
    network,
    display_name: input.displayName.trim() || null,
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** Pull an accounts array out of common partner list envelopes. */
export function extractAccountRows(raw: unknown): Record<string, unknown>[] {
  if (Array.isArray(raw)) {
    return raw.filter((row): row is Record<string, unknown> => asRecord(row) !== null);
  }
  const obj = asRecord(raw);
  if (!obj) return [];
  for (const key of ["accounts", "items", "data"] as const) {
    const nested = obj[key];
    if (Array.isArray(nested)) {
      return nested.filter((row): row is Record<string, unknown> => asRecord(row) !== null);
    }
    const nestedObj = asRecord(nested);
    if (nestedObj && Array.isArray(nestedObj.accounts)) {
      return nestedObj.accounts.filter(
        (row): row is Record<string, unknown> => asRecord(row) !== null,
      );
    }
  }
  // Single-account payload.
  if (obj.id || obj.account_id) return [obj];
  return [];
}

export function normalizeNetworkKey(network: string | null | undefined): string {
  return (network || "").trim().toLowerCase();
}

/** Partner / UI spelling → canonical Base | Polygon label used on preview. */
export function toPartnerNetwork(network: string): "Base" | "Polygon" | null {
  const key = normalizeNetworkKey(network);
  if (key === "base") return "Base";
  if (key === "polygon") return "Polygon";
  return null;
}

/**
 * UI network codes (`BASE` / `POLYGON`) already held as listed USDC accounts.
 * Mirrors Mboka `open_account` uniqueness on (asset_type, currency, network).
 */
export function occupiedStablecoinNetworkCodes(
  accounts: FinancialAccount[],
): Set<string> {
  const occupied = new Set<string>();
  for (const account of accounts) {
    if (!isListedStablecoinAccount(account)) continue;
    const partner = toPartnerNetwork(account.network);
    if (partner === "Base") occupied.add("BASE");
    if (partner === "Polygon") occupied.add("POLYGON");
  }
  return occupied;
}

export function isStablecoinNetworkOccupied(
  accounts: FinancialAccount[],
  networkCode: string,
): boolean {
  const partner = toPartnerNetwork(networkCode);
  if (!partner) return false;
  return occupiedStablecoinNetworkCodes(accounts).has(partner.toUpperCase());
}

export function isReadyStatus(status: string | null | undefined): boolean {
  return READY.has((status || "").trim().toLowerCase());
}

export function normalizeFinancialAccount(
  row: Record<string, unknown>,
  entityId: string,
): FinancialAccount | null {
  const account = asRecord(row.account) ?? row;
  const id = String(account.id ?? account.account_id ?? "").trim();
  if (!id) return null;
  const assetType = String(account.asset_type ?? account.assetType ?? "").trim();
  const currency = String(account.currency ?? "").trim().toUpperCase();
  const network = String(account.network ?? "").trim();
  const status = String(account.status ?? account.provider_status ?? "").trim();
  return { id, entityId, assetType, currency, network, status };
}

/** USDC on Base/Polygon — creatable / listable on the Accounts screen. */
export function isListedStablecoinAccount(account: FinancialAccount): boolean {
  if (account.assetType.toLowerCase() !== "stablecoin") return false;
  if (account.currency !== "USDC") return false;
  return SEND_NETWORKS.has(normalizeNetworkKey(account.network));
}

/** Accounts that Phase 4 can send from (ready USDC on Base/Polygon). */
export function isSendableStablecoinAccount(account: FinancialAccount): boolean {
  return isListedStablecoinAccount(account) && isReadyStatus(account.status);
}

async function collectStablecoinAccounts(
  predicate: (account: FinancialAccount) => boolean,
): Promise<FinancialAccount[]> {
  const entities = await entitiesApi.list();
  if (!Array.isArray(entities) || entities.length === 0) return [];

  const found: FinancialAccount[] = [];
  const seen = new Set<string>();
  for (const entity of entities) {
    if (!entity?.id) continue;
    const raw = await entitiesApi.listAccounts(entity.id);
    for (const row of extractAccountRows(raw)) {
      const account = normalizeFinancialAccount(row, entity.id);
      if (!account || !predicate(account)) continue;
      if (seen.has(account.id)) continue;
      seen.add(account.id);
      found.push(account);
    }
  }
  return found;
}

/**
 * Resolve every sendable USDC account for the authenticated principal by
 * walking `GET /v1/entities` → `GET /v1/entities/{id}/accounts`.
 */
export async function listSendableStablecoinAccounts(): Promise<FinancialAccount[]> {
  return collectStablecoinAccounts(isSendableStablecoinAccount);
}

/**
 * All USDC Base/Polygon partner accounts for the Accounts screen
 * (includes pending — not only send-ready).
 */
export async function listStablecoinAccounts(): Promise<FinancialAccount[]> {
  return collectStablecoinAccounts(isListedStablecoinAccount);
}

export function describeStablecoinAccountStatus(status: string | null | undefined): string {
  if (!status) return "Unknown";
  const key = status.trim().toLowerCase();
  if (READY.has(key)) return "Active";
  if (key === "pending" || key === "processing" || key === "opening") return "Pending";
  if (key === "failed" || key === "closed" || key === "unavailable") return "Unavailable";
  return status;
}

/** Card/detail rows for a partner stablecoin account (no invented balance). */
export function buildStablecoinAccountDetailRows(
  account: FinancialAccount,
): { label: string; value: string; copyValue?: string }[] {
  const rows: { label: string; value: string; copyValue?: string }[] = [
    { label: "Asset", value: account.currency },
    {
      label: "Network",
      value: toPartnerNetwork(account.network) ?? (account.network || "—"),
    },
    {
      label: "Status",
      value: describeStablecoinAccountStatus(account.status),
    },
  ];
  if (account.id) {
    rows.push({ label: "Account ID", value: account.id, copyValue: account.id });
  }
  return rows;
}

/** Pick the account matching the UI chain key (`base` / `polygon`). */
export function accountForNetwork(
  accounts: FinancialAccount[],
  networkKey: string,
): FinancialAccount | undefined {
  const want = normalizeNetworkKey(networkKey);
  return accounts.find((a) => normalizeNetworkKey(a.network) === want);
}
