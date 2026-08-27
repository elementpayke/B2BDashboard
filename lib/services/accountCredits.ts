import { apiEnvelope } from "@/lib/apiClient";
import type { Transaction, TransactionStatus } from "./transactions";

/**
 * Account credits — Mboka projections of partner `account.credited` events
 * (e.g. Stellar USDC inflows observed against a business FinancialAccount).
 *
 * Endpoints (Mboka — projected / may still be Limited in some envs):
 * - `GET /v1/account-credits`
 * - `GET /v1/account-credits/{id}`
 *
 * Fail closed: rows missing id, amount, financial_account_id, or observed_at
 * are dropped. `tx_hash` / `memo` are never invented when the API omits them.
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

  const id = optionalString(row.id ?? row.credit_id);
  const amount = toAmount(row.amount ?? row.amount_fiat ?? row.gross_amount);
  const financialAccountId = optionalString(
    row.financial_account_id ?? row.financialAccountId ?? row.account_id,
  );
  const observedAt = optionalString(
    row.observed_at ?? row.observedAt ?? row.created_at ?? row.createdAt,
  );
  if (!id || !amount || !financialAccountId || !observedAt) return null;

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

  return {
    id,
    tx_hash: optionalString(row.tx_hash ?? row.txHash ?? row.transaction_hash),
    amount,
    currency,
    financial_account_id: financialAccountId,
    from_address: fromAddress,
    to_address: toAddress,
    observed_at: observedAt,
    source: optionalString(row.source ?? row.event_type),
    crypto_network: optionalString(row.crypto_network ?? row.cryptoNetwork ?? row.network),
    memo: optionalString(row.memo),
    wallet_address: walletAddress,
  };
}

function isStellarNetwork(network: string | null | undefined): boolean {
  const key = (network || "").trim().toLowerCase();
  return key.includes("stellar");
}

/**
 * True when a dashboard transaction row represents an inbound Stellar deposit
 * (account credit or projected `/v1/transactions` credit).
 */
export function isInboundStellarDeposit(
  tx: Pick<Transaction, "direction" | "crypto_network" | "source">,
): boolean {
  if (tx.direction !== "in") return false;
  if (isStellarNetwork(tx.crypto_network)) return true;
  const source = (tx.source || "").trim().toLowerCase();
  return source.includes("stellar");
}

/**
 * Project an AccountCredit into the dashboard `Transaction` read-view so
 * Activity / detail can reuse existing presentation without inventing data.
 */
export function mapAccountCreditToTransaction(credit: AccountCredit): Transaction {
  const status: TransactionStatus = "completed";
  return {
    id: credit.id,
    direction: "in",
    status,
    amount_fiat: credit.amount,
    currency: credit.currency,
    aggregator_order_id: null,
    external_order_id: null,
    wallet_address: credit.wallet_address,
    provider: null,
    order_type: null,
    crypto_currency: credit.currency.toUpperCase() === "USDC" ? "USDC" : credit.currency,
    crypto_network: credit.crypto_network,
    exchange_rate: null,
    psp_transaction_id: null,
    payment: null,
    tx_hash: credit.tx_hash,
    memo: credit.memo,
    financial_account_id: credit.financial_account_id,
    source: credit.source,
    created_at: credit.observed_at,
    updated_at: credit.observed_at,
  };
}

/**
 * Account detail "Recent" — when Mboka projects `financial_account_id` on
 * activity rows, prefer rows for that wallet. If the feed has no scoped ids
 * yet, keep the unfiltered page (fail open on older APIs). Never invent rows.
 */
export function recentActivityForFinancialAccount<
  T extends { financial_account_id?: string | null },
>(items: T[], financialAccountId: string | null | undefined): T[] {
  const accountId = String(financialAccountId ?? "").trim();
  if (!accountId) return items;
  const anyScoped = items.some((row) => Boolean(String(row.financial_account_id ?? "").trim()));
  if (!anyScoped) return items;
  return items.filter(
    (row) => String(row.financial_account_id ?? "").trim() === accountId,
  );
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
    const raw = await apiEnvelope<unknown>(
      "GET",
      `/v1/account-credits/${encodeURIComponent(id)}`,
    );
    return normalizeAccountCredit(raw);
  },
};
