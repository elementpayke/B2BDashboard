import { apiEnvelope } from "@/lib/apiClient";
import { formatAccountBalance, pickAvailableBalance } from "@/lib/services/balances";

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
  /** On-chain deposit address when the partner returns one. */
  walletAddress?: string | null;
  /** Partner chain warning from deposit-instructions / account payload. */
  chainDisclaimer?: string | null;
  /** Hosted checkout URL when the provider returns one (often null). */
  checkoutUrl?: string | null;
  /** Live balance when the partner includes it on list/get. */
  balance?: {
    available?: string | null;
    current?: string | null;
    currency?: string | null;
  } | null;
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

/**
 * Keep a partner balance amount only when it parses to a finite number.
 * `String(...)` alone would turn `NaN`, `Infinity`, or `"n/a"` into a string
 * that formatting passes straight through to the UI as a balance.
 */
function toBalanceAmount(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const raw = String(value).trim();
  if (!raw) return null;
  return Number.isFinite(Number(raw.replace(/,/g, ""))) ? raw : null;
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

/** Partner / UI spelling → display label. Known rails get canonical names; others keep API casing. */
export function toPartnerNetwork(network: string): "Base" | "Polygon" | null {
  const key = normalizeNetworkKey(network);
  if (key === "base") return "Base";
  if (key === "polygon") return "Polygon";
  return null;
}

/** Dynamic network label for UX — never hardcode a chain the backend didn't return. */
export function formatNetworkLabel(network: string | null | undefined): string {
  const raw = (network || "").trim();
  if (!raw) return "—";
  return toPartnerNetwork(raw) ?? raw;
}

/**
 * UI network codes (`BASE` / `POLYGON`) already held as listed **USDC** accounts
 * for Phase 4 create uniqueness. Other assets/networks from the API do not
 * consume these create slots.
 */
export function occupiedStablecoinNetworkCodes(
  accounts: FinancialAccount[],
): Set<string> {
  const occupied = new Set<string>();
  for (const account of accounts) {
    if (account.assetType.toLowerCase() !== "stablecoin") continue;
    if (account.currency !== "USDC") continue;
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

/** Accept only http(s) checkout links — reject javascript:/data:/etc. */
export function toHttpUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.href;
  } catch {
    return null;
  }
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
  const walletRaw = account.wallet_address ?? account.walletAddress ?? account.address;
  const walletAddress =
    typeof walletRaw === "string" && walletRaw.trim() ? walletRaw.trim() : null;
  const disclaimerRaw = account.chain_disclaimer ?? account.chainDisclaimer;
  const chainDisclaimer =
    typeof disclaimerRaw === "string" && disclaimerRaw.trim() ? disclaimerRaw.trim() : null;
  const checkoutUrl = toHttpUrl(account.checkout_url ?? account.checkoutUrl);
  const balanceRaw = asRecord(account.balance);
  const balance = balanceRaw
    ? {
        available: toBalanceAmount(balanceRaw.available),
        current: toBalanceAmount(balanceRaw.current),
        currency:
          typeof balanceRaw.currency === "string" && balanceRaw.currency.trim()
            ? balanceRaw.currency.trim().toUpperCase()
            : currency || null,
      }
    : null;
  return {
    id,
    entityId,
    assetType,
    currency,
    network,
    status,
    walletAddress,
    chainDisclaimer,
    checkoutUrl,
    balance,
  };
}

/** Any stablecoin rail returned by the API (for wallets list / fund UX). */
export function isListedStablecoinAccount(account: FinancialAccount): boolean {
  return account.assetType.toLowerCase() === "stablecoin" && Boolean(account.currency);
}

/** Ready stablecoin rails with a deposit address — fundable via on-chain transfer. */
export function isFundableStablecoinAccount(account: FinancialAccount): boolean {
  return (
    isListedStablecoinAccount(account) &&
    isReadyStatus(account.status) &&
    Boolean(account.walletAddress?.trim())
  );
}

/** Phase 4 sendable: ready USDC on Base/Polygon only. */
export function isSendableStablecoinAccount(account: FinancialAccount): boolean {
  if (!isListedStablecoinAccount(account)) return false;
  if (account.currency !== "USDC") return false;
  if (!SEND_NETWORKS.has(normalizeNetworkKey(account.network))) return false;
  return isReadyStatus(account.status);
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
 * All partner stablecoin accounts for the Accounts / fund surfaces
 * (includes pending; any asset/network the API returns).
 */
export async function listStablecoinAccounts(): Promise<FinancialAccount[]> {
  return collectStablecoinAccounts(isListedStablecoinAccount);
}

/** Ready stablecoin accounts that expose a deposit wallet address. */
export async function listFundableStablecoinAccounts(): Promise<FinancialAccount[]> {
  return collectStablecoinAccounts(isFundableStablecoinAccount);
}

export function describeStablecoinAccountStatus(status: string | null | undefined): string {
  if (!status) return "Unknown";
  const key = status.trim().toLowerCase();
  if (READY.has(key)) return "Active";
  if (key === "pending" || key === "processing" || key === "opening") return "Pending";
  if (key === "failed" || key === "closed" || key === "unavailable") return "Unavailable";
  return status;
}

/** Card/detail rows for a partner stablecoin account. */
export function buildStablecoinAccountDetailRows(
  account: FinancialAccount,
): { label: string; value: string; copyValue?: string }[] {
  const rows: { label: string; value: string; copyValue?: string }[] = [
    { label: "Asset", value: account.currency },
    {
      label: "Network",
      value: formatNetworkLabel(account.network),
    },
    {
      label: "Status",
      value: describeStablecoinAccountStatus(account.status),
    },
  ];
  // Shared helpers, so this row matches the formatting used on account cards.
  if (pickAvailableBalance(account.balance)) {
    rows.push({
      label: "Available balance",
      value: `${formatAccountBalance(account.balance)} ${account.balance?.currency || account.currency}`,
    });
  }
  if (account.walletAddress) {
    rows.push({
      label: "Deposit address",
      value: account.walletAddress,
      copyValue: account.walletAddress,
    });
  }
  if (account.id) {
    rows.push({ label: "Account ID", value: account.id, copyValue: account.id });
  }
  return rows;
}

/**
 * Build UX rails for the Fund-via-stablecoin flow from API accounts.
 * One entry per fundable (ready + wallet) account — asset/network come from backend.
 */
export function buildFundStablecoinRails(
  accounts: FinancialAccount[],
): FundStablecoinRail[] {
  return accounts.filter(isFundableStablecoinAccount).map((account) => {
    const networkLabel = formatNetworkLabel(account.network);
    return {
      id: account.id,
      currency: account.currency,
      network: account.network,
      networkLabel,
      walletAddress: account.walletAddress!.trim(),
      chainDisclaimer:
        account.chainDisclaimer ||
        `Send only ${account.currency} on ${networkLabel}. Funds sent on the wrong network may be lost.`,
      checkoutUrl: account.checkoutUrl ?? null,
    };
  });
}

export type FundStablecoinRail = {
  id: string;
  currency: string;
  network: string;
  networkLabel: string;
  walletAddress: string;
  chainDisclaimer: string;
  checkoutUrl: string | null;
};

/** Pick the account matching the UI chain key (`base` / `polygon`). */
export function accountForNetwork(
  accounts: FinancialAccount[],
  networkKey: string,
): FinancialAccount | undefined {
  const want = normalizeNetworkKey(networkKey);
  return accounts.find((a) => normalizeNetworkKey(a.network) === want);
}
