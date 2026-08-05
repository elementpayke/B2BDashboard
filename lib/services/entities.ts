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

export const entitiesApi = {
  list: () => apiEnvelope<ProviderEntity[]>("GET", "/v1/entities"),
  listAccounts: (entityId: string) =>
    apiEnvelope<unknown>("GET", `/v1/entities/${encodeURIComponent(entityId)}/accounts`),
};

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

/** Accounts that Phase 4 can send from (ready USDC on Base/Polygon). */
export function isSendableStablecoinAccount(account: FinancialAccount): boolean {
  if (account.assetType.toLowerCase() !== "stablecoin") return false;
  if (account.currency !== "USDC") return false;
  if (!isReadyStatus(account.status)) return false;
  return SEND_NETWORKS.has(normalizeNetworkKey(account.network));
}

/**
 * Resolve every sendable USDC account for the authenticated principal by
 * walking `GET /v1/entities` → `GET /v1/entities/{id}/accounts`.
 */
export async function listSendableStablecoinAccounts(): Promise<FinancialAccount[]> {
  const entities = await entitiesApi.list();
  if (!Array.isArray(entities) || entities.length === 0) return [];

  const found: FinancialAccount[] = [];
  const seen = new Set<string>();
  for (const entity of entities) {
    if (!entity?.id) continue;
    const raw = await entitiesApi.listAccounts(entity.id);
    for (const row of extractAccountRows(raw)) {
      const account = normalizeFinancialAccount(row, entity.id);
      if (!account || !isSendableStablecoinAccount(account)) continue;
      if (seen.has(account.id)) continue;
      seen.add(account.id);
      found.push(account);
    }
  }
  return found;
}

/** Pick the account matching the UI chain key (`base` / `polygon`). */
export function accountForNetwork(
  accounts: FinancialAccount[],
  networkKey: string,
): FinancialAccount | undefined {
  const want = normalizeNetworkKey(networkKey);
  return accounts.find((a) => normalizeNetworkKey(a.network) === want);
}
