import { apiEnvelope } from "@/lib/apiClient";
import type { Transaction, TransactionStatus } from "./transactions";

/**
 * Account credits — Mboka Horizon watcher observations for inbound Stellar USDC.
 *
 * Endpoints:
 * - `GET /v1/account-credits`
 * - `GET /v1/account-credits/{id}` (numeric PK — strip `acr_` before calling)
 *
 * Wire today: `id` int, `account_id` (provider account id), `created_at`,
 * `tx_hash`, addresses, optional `memo`. `crypto_network` / `source` may be
 * absent; FE fills Stellar defaults for this Stellar-only endpoint.
 *
 * See `docs/api-contract.md` (Stellar inbound account-credit mapping notes).
 */

export type AccountCredit = {
  id: string;
  tx_hash: string | null;
  amount: string;
  currency: string;
  financial_account_id: string;
  from_address: string | null;
  to_address: string | null;
  observed_at: string;
  source: string | null;
  crypto_network: string | null;
  memo: string | null;
  /** Prefer to_address; falls back to any wallet field on the wire. */
  wallet_address: string | null;
};

export type AccountCreditList = {
  items: AccountCredit[];
  total: number;
};

export type RecentActivityScope =
  | string
  | null
  | undefined
  | {
      financialAccountId?: string | null;
      walletAddress?: string | null;
    };

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function optionalString(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const trimmed = String(value).trim();
  return trimmed ? trimmed : null;
}

/** Keep an amount only when it parses to a finite number — never invent. */
function toAmount(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const raw = String(value).trim();
  if (!raw) return null;
  return Number.isFinite(Number(raw.replace(/,/g, ""))) ? raw : null;
}

/** Dashboard / transactions id: numeric Mboka PK → `acr_<n>`. */
export function toAccountCreditId(raw: string | number): string {
  const value = String(raw ?? "").trim();
  if (!value) return value;
  if (value.startsWith("acr_")) return value;
  if (/^\d+$/.test(value)) return `acr_${value}`;
  return value;
}

/**
 * Path segment for `GET /v1/account-credits/{id}` — Mboka expects an int.
 * Only strips `acr_` when the suffix is all digits.
 */
export function accountCreditApiPathId(raw: string | number): string {
  const value = String(raw ?? "").trim();
  if (value.startsWith("acr_")) {
    const suffix = value.slice("acr_".length);
    if (/^\d+$/.test(suffix)) return suffix;
  }
  return value;
}

/** Pull credit rows out of common list envelopes. */
export function extractAccountCreditRows(raw: unknown): Record<string, unknown>[] {
  if (Array.isArray(raw)) {
    return raw.filter((row): row is Record<string, unknown> => asRecord(row) !== null);
  }
  const obj = asRecord(raw);
  if (!obj) return [];
  for (const key of ["items", "credits", "data"] as const) {
    const nested = obj[key];
    if (Array.isArray(nested)) {
      return nested.filter((row): row is Record<string, unknown> => asRecord(row) !== null);
    }
  }
  if (obj.id || obj.credit_id) return [obj];
  return [];
}

/**
 * Normalize a raw account-credit payload. Returns `null` when required fields
 * are missing or unusable (fail closed — no invented balances/hashes).
 */
export function normalizeAccountCredit(raw: unknown): AccountCredit | null {
  const row = asRecord(raw);
  if (!row) return null;

  const rawId = optionalString(row.id ?? row.credit_id);
  const amount = toAmount(row.amount ?? row.amount_fiat ?? row.gross_amount);
  const financialAccountId = optionalString(
    row.financial_account_id ?? row.financialAccountId ?? row.account_id,
  );
  const observedAt = optionalString(
    row.observed_at ?? row.observedAt ?? row.created_at ?? row.createdAt,
  );
  if (!rawId || !amount || !financialAccountId || !observedAt) return null;

  const currency =
    optionalString(row.currency ?? row.currency_code)?.toUpperCase() ?? "USDC";
  const fromAddress = optionalString(
    row.from_address ?? row.fromAddress ?? row.from ?? row.sender,
  );
  const toAddress = optionalString(
    row.to_address ?? row.toAddress ?? row.to ?? row.recipient,
  );
  const walletAddress =
    optionalString(row.wallet_address ?? row.walletAddress) ?? toAddress;
  const cryptoNetwork =
    optionalString(row.crypto_network ?? row.cryptoNetwork ?? row.network) ?? "Stellar";

  return {
    id: toAccountCreditId(rawId),
    tx_hash: optionalString(row.tx_hash ?? row.txHash ?? row.transaction_hash),
    amount,
    currency,
    financial_account_id: financialAccountId,
    from_address: fromAddress,
    to_address: toAddress,
    observed_at: observedAt,
    source: optionalString(row.source ?? row.event_type),
    crypto_network: cryptoNetwork,
    memo: optionalString(row.memo),
    wallet_address: walletAddress,
  };
}

function isStellarNetwork(network: string | null | undefined): boolean {
  const key = (network || "").trim().toLowerCase();
  return key.includes("stellar");
}

/**
 * True when a dashboard transaction row represents an inbound Stellar deposit.
 * Matches Mboka today (`provider: "stellar"`, `acr_<n>` + `tx_hash`) and the
 * fuller `crypto_network` / `source` fields when the backend adds them.
 */
export function isInboundStellarDeposit(
  tx: Pick<
    Transaction,
    "direction" | "crypto_network" | "source" | "provider" | "id" | "tx_hash"
  >,
): boolean {
  if (tx.direction !== "in") return false;
  if (isStellarNetwork(tx.crypto_network)) return true;
  const source = (tx.source || "").trim().toLowerCase();
  if (source.includes("stellar")) return true;
  const provider = (tx.provider || "").trim().toLowerCase();
  if (provider.includes("stellar")) return true;
  const id = String(tx.id ?? "");
  if (id.startsWith("acr_") && Boolean(String(tx.tx_hash ?? "").trim())) {
    if (tx.crypto_network && !isStellarNetwork(tx.crypto_network)) return false;
    return true;
  }
  return false;
}

/**
 * Project an AccountCredit into the dashboard `Transaction` read-view so
 * Activity / detail can reuse existing presentation without inventing data.
 */
export function mapAccountCreditToTransaction(credit: AccountCredit): Transaction {
  const status: TransactionStatus = "completed";
  const network = credit.crypto_network ?? "Stellar";
  const stellar = isStellarNetwork(network);
  return {
    id: credit.id,
    direction: "in",
    status,
    amount_fiat: credit.amount,
    currency: credit.currency,
    aggregator_order_id: null,
    external_order_id: null,
    wallet_address: credit.wallet_address,
    provider: stellar ? "stellar" : null,
    order_type: null,
    crypto_currency: credit.currency.toUpperCase() === "USDC" ? "USDC" : credit.currency,
    crypto_network: network,
    exchange_rate: null,
    psp_transaction_id: null,
    payment: null,
    tx_hash: credit.tx_hash,
    memo: credit.memo,
    financial_account_id: credit.financial_account_id,
    source: credit.source ?? (stellar ? "stellar_payment" : null),
    created_at: credit.observed_at,
    updated_at: credit.observed_at,
  };
}

function resolveRecentScope(scope: RecentActivityScope): {
  financialAccountId: string;
  walletAddress: string;
} {
  if (scope && typeof scope === "object") {
    return {
      financialAccountId: String(scope.financialAccountId ?? "").trim(),
      walletAddress: String(scope.walletAddress ?? "").trim(),
    };
  }
  return {
    financialAccountId: String(scope ?? "").trim(),
    walletAddress: "",
  };
}

/**
 * Account detail "Recent" — prefer rows for the open wallet when the feed
 * carries `financial_account_id` / `account_id`, or match `wallet_address`
 * when Mboka only projects the G… (current transactions merge). Never invent.
 */
export function recentActivityForFinancialAccount<
  T extends {
    financial_account_id?: string | null;
    wallet_address?: string | null;
  },
>(items: T[], scope: RecentActivityScope): T[] {
  const { financialAccountId, walletAddress } = resolveRecentScope(scope);
  if (!financialAccountId && !walletAddress) return items;

  const anyAccountScoped = items.some((row) =>
    Boolean(String(row.financial_account_id ?? "").trim()),
  );
  if (anyAccountScoped && financialAccountId) {
    return items.filter(
      (row) => String(row.financial_account_id ?? "").trim() === financialAccountId,
    );
  }

  const anyWalletScoped = items.some((row) =>
    Boolean(String(row.wallet_address ?? "").trim()),
  );
  if (anyWalletScoped && walletAddress) {
    const want = walletAddress.toUpperCase();
    return items.filter(
      (row) => String(row.wallet_address ?? "").trim().toUpperCase() === want,
    );
  }

  return items;
}

function normalizeCreditsList(raw: unknown): AccountCreditList {
  const rows = extractAccountCreditRows(raw);
  const items = rows
    .map((row) => normalizeAccountCredit(row))
    .filter((row): row is AccountCredit => row !== null);
  const obj = asRecord(raw);
  const totalRaw = obj?.total;
  const total =
    typeof totalRaw === "number" && Number.isFinite(totalRaw) ? totalRaw : items.length;
  return { items, total };
}

export const accountCreditsApi = {
  list: async (): Promise<AccountCreditList> => {
    const raw = await apiEnvelope<unknown>("GET", "/v1/account-credits");
    return normalizeCreditsList(raw);
  },

  get: async (id: string): Promise<AccountCredit | null> => {
    const pathId = accountCreditApiPathId(id);
    const raw = await apiEnvelope<unknown>(
      "GET",
      `/v1/account-credits/${encodeURIComponent(pathId)}`,
    );
    return normalizeAccountCredit(raw);
  },
};
