import { apiEnvelope } from "@/lib/apiClient";
import type { Transaction, TransactionStatus } from "./transactions";

/**
 * Issued-card spend / authorizations from Mboka:
 * - `GET /v1/entities/{entity}/accounts/{account}/card-transactions`
 * - `GET /v1/entities/{entity}/accounts/{account}/cards/{card}/transactions`
 *
 * Sandbox spend is often empty (partner does not simulate). Declined rows are
 * included when upstream returns them — status + narration only (no decline_reason).
 */

export type CardTransaction = {
  transaction_id: string;
  card_id: string;
  account_id: string;
  entity_id?: string | null;
  amount: string;
  currency: string;
  status: string;
  type: string;
  payment_type?: string | null;
  narration?: string | null;
  created_at: string;
  card_last_four?: string | null;
  card_name?: string | null;
};

export type CardTransactionList = {
  entity_id?: string;
  account_id?: string;
  card_id?: string;
  transactions: CardTransaction[];
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

function toAmount(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const raw = String(value).trim();
  if (!raw) return null;
  return Number.isFinite(Number(raw.replace(/,/g, ""))) ? raw : null;
}

/** Stable dashboard id — never invent when partner id is missing. */
export function toCardTransactionId(raw: string | number): string {
  const value = String(raw ?? "").trim();
  if (!value) return value;
  if (value.startsWith("ctx_")) return value;
  return `ctx_${value}`;
}

export function isCardSpendTransaction(
  transaction: Pick<Transaction, "id" | "source" | "provider">,
): boolean {
  if (String(transaction.id || "").startsWith("ctx_")) return true;
  const source = String(transaction.source || "").toLowerCase();
  if (source === "card_authorization" || source === "card_spend") return true;
  return String(transaction.provider || "").toLowerCase() === "card";
}

export function extractCardTransactionRows(raw: unknown): Record<string, unknown>[] {
  if (Array.isArray(raw)) {
    return raw.filter((row): row is Record<string, unknown> => asRecord(row) !== null);
  }
  const obj = asRecord(raw);
  if (!obj) return [];
  for (const key of ["transactions", "items", "data"] as const) {
    const nested = obj[key];
    if (Array.isArray(nested)) {
      return nested.filter((row): row is Record<string, unknown> => asRecord(row) !== null);
    }
  }
  if (obj.transaction_id || obj.id) return [obj];
  return [];
}

function toIsoCreatedAt(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    const ms = value > 1_000_000_000_000 ? value : value * 1000;
    const date = new Date(ms);
    return Number.isFinite(date.getTime()) ? date.toISOString() : null;
  }
  const text = String(value).trim();
  if (!text) return null;
  if (/^\d+$/.test(text)) return toIsoCreatedAt(Number(text));
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed)) return null;
  const date = new Date(parsed);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

export function mapCardTxnStatus(raw: string | null | undefined): TransactionStatus {
  const key = String(raw || "").trim().toLowerCase();
  if (
    key === "declined" ||
    key === "denied" ||
    key === "rejected" ||
    key === "refuse" ||
    key === "refused"
  ) {
    return "declined";
  }
  if (
    key === "completed" ||
    key === "settled" ||
    key === "captured" ||
    key === "success" ||
    key === "successful" ||
    key === "approved"
  ) {
    return "completed";
  }
  if (key === "refunded" || key === "reversed" || key === "refund") return "refunded";
  if (key === "canceled" || key === "cancelled" || key === "void") return "canceled";
  if (key === "failed" || key === "error") return "failed";
  if (
    key === "pending" ||
    key === "processing" ||
    key === "authorized" ||
    key === "authorised" ||
    key === "clearing"
  ) {
    return "processing";
  }
  // Unknown partner statuses fail closed — don't look "Pending".
  return "failed";
}

export function normalizeCardTransaction(raw: unknown): CardTransaction | null {
  const row = asRecord(raw);
  if (!row) return null;

  const txnId = optionalString(row.transaction_id ?? row.id ?? row._id);
  const amount = toAmount(row.amount ?? row.amount_fiat);
  const cardId = optionalString(row.card_id ?? row.cardId);
  const accountId = optionalString(
    row.account_id ?? row.accountId ?? row.financial_account_id,
  );
  const createdAt = toIsoCreatedAt(row.created_at ?? row.createdAt ?? row.created);
  if (!txnId || !amount || !cardId || !accountId || !createdAt) return null;

  const narration = optionalString(
    row.narration ?? row.merchant_name ?? row.merchant,
  );

  return {
    transaction_id: txnId,
    card_id: cardId,
    account_id: accountId,
    entity_id: optionalString(row.entity_id ?? row.entityId),
    amount,
    currency: (optionalString(row.currency) || "USD").toUpperCase(),
    status: optionalString(row.status)?.toLowerCase() || "pending",
    type: optionalString(row.type ?? row.txn_type)?.toLowerCase() || "debit",
    payment_type: optionalString(row.payment_type ?? row.paymentType)?.toLowerCase(),
    narration,
    created_at: createdAt,
    card_last_four: optionalString(row.card_last_four ?? row.last_four ?? row.last4),
    card_name: optionalString(row.card_name ?? row.cardName),
  };
}

export function mergeCardTransactionList(
  current: CardTransactionList | undefined,
  next: CardTransaction,
): CardTransactionList {
  const transactions = [
    next,
    ...(current?.transactions ?? []).filter(
      (row) => row.transaction_id !== next.transaction_id,
    ),
  ].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));

  return {
    entity_id: next.entity_id ?? current?.entity_id,
    account_id: next.account_id || current?.account_id,
    card_id: current?.card_id,
    transactions,
  };
}

/**
 * Merge a polled/fetched snapshot with any live SSE rows already in cache.
 * Fetches must not wipe newer live patches that arrived while the request was in flight.
 */
export function reconcileCardTransactionList(
  fetched: CardTransactionList,
  live: CardTransactionList | undefined,
): CardTransactionList {
  if (!live?.transactions?.length) return fetched;
  const byId = new Map<string, CardTransaction>();
  for (const row of fetched.transactions) {
    byId.set(row.transaction_id, row);
  }
  for (const row of live.transactions) {
    const existing = byId.get(row.transaction_id);
    if (!existing) {
      byId.set(row.transaction_id, row);
      continue;
    }
    // Prefer the row that looks newer (created_at), else keep live status/fields.
    const liveNewer =
      String(row.created_at).localeCompare(String(existing.created_at)) >= 0;
    byId.set(row.transaction_id, liveNewer ? { ...existing, ...row } : { ...row, ...existing });
  }
  const transactions = Array.from(byId.values()).sort((a, b) =>
    String(b.created_at).localeCompare(String(a.created_at)),
  );
  return {
    entity_id: fetched.entity_id ?? live.entity_id,
    account_id: fetched.account_id || live.account_id,
    card_id: fetched.card_id ?? live.card_id,
    transactions,
  };
}

function normalizeList(raw: unknown): CardTransactionList {
  const obj = asRecord(raw);
  const items = extractCardTransactionRows(raw)
    .map((row) => normalizeCardTransaction(row))
    .filter((row): row is CardTransaction => row !== null);
  return {
    entity_id: optionalString(obj?.entity_id) ?? undefined,
    account_id: optionalString(obj?.account_id) ?? undefined,
    card_id: optionalString(obj?.card_id) ?? undefined,
    transactions: items,
  };
}

export function mapCardTransactionToTransaction(txn: CardTransaction): Transaction {
  const status = mapCardTxnStatus(txn.status);
  const type = txn.type.toLowerCase();
  const isRefund =
    type === "credit" ||
    type === "refund" ||
    type === "reversal" ||
    status === "refunded";
  const direction = isRefund && status !== "declined" ? "in" : "out";
  const merchant = txn.narration?.trim() || null;
  const last4 = txn.card_last_four?.trim();
  const cardLabel = txn.card_name?.trim()
    ? txn.card_name.trim()
    : last4
      ? `Card ···· ${last4}`
      : null;
  const id = toCardTransactionId(txn.transaction_id);
  return {
    id,
    direction,
    status,
    amount_fiat: txn.amount,
    currency: txn.currency,
    aggregator_order_id: null,
    external_order_id: txn.transaction_id,
    wallet_address: null,
    provider: "card",
    order_type: null,
    crypto_currency: null,
    crypto_network: null,
    exchange_rate: null,
    psp_transaction_id: null,
    payment: {
      party_name: merchant || cardLabel || "Card spend",
      account_name: cardLabel,
      account_number: last4 ? `···· ${last4}` : null,
      account_kind: "card",
      method_type: "card",
      network_name: cardLabel,
    },
    tx_hash: null,
    memo: merchant && status === "declined" ? merchant : null,
    financial_account_id: txn.account_id,
    card_id: txn.card_id,
    source: "card_authorization",
    created_at: txn.created_at,
    updated_at: txn.created_at,
  };
}

export const cardTransactionsApi = {
  listForAccount: async (
    entityId: string,
    accountId: string,
    opts?: { limit?: number },
  ): Promise<CardTransactionList> => {
    const limit = opts?.limit ?? 50;
    const qs = `?limit=${encodeURIComponent(String(limit))}`;
    const raw = await apiEnvelope<unknown>(
      "GET",
      `/v1/entities/${encodeURIComponent(entityId)}/accounts/${encodeURIComponent(accountId)}/card-transactions${qs}`,
    );
    return normalizeList(raw);
  },

  listForCard: async (
    entityId: string,
    accountId: string,
    cardId: string,
    opts?: { limit?: number },
  ): Promise<CardTransactionList> => {
    const limit = opts?.limit ?? 20;
    const qs = `?limit=${encodeURIComponent(String(limit))}`;
    const raw = await apiEnvelope<unknown>(
      "GET",
      `/v1/entities/${encodeURIComponent(entityId)}/accounts/${encodeURIComponent(accountId)}/cards/${encodeURIComponent(cardId)}/transactions${qs}`,
    );
    return normalizeList(raw);
  },
};
