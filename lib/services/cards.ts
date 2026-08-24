import { apiEnvelope } from "@/lib/apiClient";
import { newIdempotencyKey } from "@/lib/services/orders";
import type { DepositAccount } from "@/lib/services/depositAccounts";
import {
  entitiesApi,
  extractAccountRows,
  isReadyStatus,
  normalizeFinancialAccount,
  type ProviderEntity,
} from "@/lib/services/entities";
import { formatAccountBalance } from "@/lib/services/balances";

/**
 * Card issuing — every card is linked to an **active fiat USD** funding account
 * (`POST /v1/entities/{entity_id}/accounts/{account_id}/cards`).
 * PAN/CVV appear only on successful create.
 */

/** Partner cardholder phone: E.164 (`+` + country + subscriber). */
export const CARD_E164_RE = /^\+[1-9]\d{6,14}$/;

export type IssuedCard = {
  id: string;
  account_id: string;
  entity_id: string;
  type: string;
  status: string;
  reference?: string | null;
  card_name?: string | null;
  currency: string;
  last_four?: string | null;
  expiration_month?: string | null;
  expiration_year?: string | null;
  number?: string | null;
  cvv?: string | null;
  created_at?: string | null;
};

export type CardholderIn = {
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string;
};

export type CardCreateIn = {
  type: "virtual" | "disposable";
  reference: string;
  card_name: string;
  cardholder: CardholderIn;
  expiration_month?: string;
  expiration_year?: string;
};

export type UsdFundingAccount = {
  entityId: string;
  accountId: string;
  currency: "USD";
  balanceLabel: string;
  status: string;
  /** Optional IBAN / account mask for UX (never invent). */
  accountMask?: string | null;
};

export function isValidCardE164(phone: string): boolean {
  return CARD_E164_RE.test(phone.trim());
}

export function isValidCardholderEmail(email: string): boolean {
  const value = email.trim();
  return value.length >= 3 && value.length <= 255 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function isActiveUsdFundingAccount(
  account: Pick<DepositAccount, "id" | "currency" | "status">,
): boolean {
  return (
    Boolean(account.id) &&
    account.currency.toUpperCase() === "USD" &&
    (account.status === "active" || isReadyStatus(account.status))
  );
}

function maskIban(iban: string | null | undefined): string | null {
  if (!iban) return null;
  const compact = iban.replace(/\s+/g, "").toUpperCase();
  if (compact.length < 8) return compact;
  return `${compact.slice(0, 4)} ···· ${compact.slice(-4)}`;
}

/** Prefer IBAN/deposit USD row; fall back to entity fiat USD FinancialAccount. */
export async function resolveUsdFundingAccount(params: {
  depositAccounts: DepositAccount[];
  entities?: ProviderEntity[];
}): Promise<UsdFundingAccount | null> {
  const depositUsd = params.depositAccounts.find(isActiveUsdFundingAccount);
  const entities =
    params.entities ??
    (await entitiesApi.list().catch(() => [] as ProviderEntity[]));

  if (depositUsd?.id) {
    const accountId = String(depositUsd.id);
    if (depositUsd.entity_id) {
      return {
        entityId: String(depositUsd.entity_id),
        accountId,
        currency: "USD",
        balanceLabel: formatAccountBalance(depositUsd.balance),
        status: depositUsd.status,
        accountMask: maskIban(depositUsd.iban),
      };
    }
    // Prefer the entity that actually owns this account id.
    for (const entity of entities) {
      if (!entity?.id) continue;
      try {
        const raw = await entitiesApi.listAccounts(entity.id);
        const owns = extractAccountRows(raw).some((row) => {
          const account = normalizeFinancialAccount(row, entity.id);
          return account?.id === accountId && account.currency === "USD";
        });
        if (owns) {
          return {
            entityId: String(entity.id),
            accountId,
            currency: "USD",
            balanceLabel: formatAccountBalance(depositUsd.balance),
            status: depositUsd.status,
            accountMask: maskIban(depositUsd.iban),
          };
        }
      } catch {
        // try next entity
      }
    }
    // No fallback to entities[0]: `DepositAccount` carries no entity id, and
    // the card endpoint nests accountId under entityId. Pairing the account
    // with an unverified entity would issue against the wrong pair (or fail
    // upstream). Fall through to the scan below instead.
  }

  for (const entity of entities) {
    if (!entity?.id) continue;
    let raw: unknown;
    try {
      raw = await entitiesApi.listAccounts(entity.id);
    } catch {
      // One unreachable entity must not hide a valid USD account on a later one.
      continue;
    }
    for (const row of extractAccountRows(raw)) {
      const account = normalizeFinancialAccount(row, entity.id);
      if (!account) continue;
      if (account.currency !== "USD") continue;
      if (account.assetType.toLowerCase() === "stablecoin") continue;
      if (!isReadyStatus(account.status)) continue;
      return {
        entityId: String(entity.id),
        accountId: account.id,
        currency: "USD",
        balanceLabel: formatAccountBalance(account.balance),
        status: account.status,
        accountMask: null,
      };
    }
  }
  return null;
}

export function describeUsdFunding(funding: UsdFundingAccount | null): string {
  if (!funding) {
    return "Cards spend from your active USD deposit account balance.";
  }
  const available =
    funding.balanceLabel !== "—" ? `$${funding.balanceLabel}` : "—";
  const mask = funding.accountMask ? ` · ${funding.accountMask}` : "";
  return `Linked to active USD${mask} · available ${available}`;
}

export function describeUsdFundingIssueNote(funding: UsdFundingAccount): string {
  const available =
    funding.balanceLabel !== "—" ? `$${funding.balanceLabel}` : "—";
  return `Issues a virtual card on your active USD account. Spend comes from that balance (${available}) — not a separate card wallet.`;
}

export function newCardReference(label: string): string {
  const slug = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return `card-${slug || "virtual"}-${newIdempotencyKey().slice(0, 8)}`;
}

export function describeCardStatus(status: string | null | undefined): string {
  const key = (status || "").toLowerCase();
  if (key === "active" || key === "open") return "Active";
  if (key === "frozen" || key === "blocked") return "Frozen";
  if (key === "pending") return "Pending";
  if (key === "closed" || key === "terminated") return "Closed";
  return status || "Unknown";
}

export function cardPlasticBg(index: number): string {
  return index % 2 === 0 ? "#131126" : "#3B2ED3";
}

/** Prefill cardholder from KYB associate when present — never invent names. */
export function cardholderPrefillFromKybProfile(
  profile: Record<string, unknown> | null | undefined,
): Partial<CardholderIn> {
  if (!profile || typeof profile !== "object") return {};
  const associates = profile.associates;
  if (!Array.isArray(associates) || associates.length === 0) return {};
  const first = associates[0];
  if (!first || typeof first !== "object") return {};
  const row = first as Record<string, unknown>;
  const fullName =
    row.full_name && typeof row.full_name === "object"
      ? (row.full_name as Record<string, unknown>)
      : null;
  const firstName =
    typeof fullName?.first_name === "string" ? fullName.first_name.trim() : "";
  const lastName =
    typeof fullName?.last_name === "string" ? fullName.last_name.trim() : "";
  const phone =
    typeof row.phone_number === "string" ? row.phone_number.trim() : "";
  const email = typeof row.email === "string" ? row.email.trim() : "";
  return {
    ...(firstName ? { first_name: firstName } : {}),
    ...(lastName ? { last_name: lastName } : {}),
    ...(phone ? { phone_number: phone } : {}),
    ...(email ? { email } : {}),
  };
}

export const cardsApi = {
  list(entityId: string, accountId: string): Promise<{
    account_id: string;
    entity_id: string;
    cards: IssuedCard[];
  }> {
    return apiEnvelope(
      "GET",
      `/v1/entities/${encodeURIComponent(entityId)}/accounts/${encodeURIComponent(accountId)}/cards`,
    );
  },

  create(
    entityId: string,
    accountId: string,
    body: CardCreateIn,
  ): Promise<IssuedCard> {
    return apiEnvelope(
      "POST",
      `/v1/entities/${encodeURIComponent(entityId)}/accounts/${encodeURIComponent(accountId)}/cards`,
      body,
    );
  },

  get(entityId: string, accountId: string, cardId: string): Promise<IssuedCard> {
    return apiEnvelope(
      "GET",
      `/v1/entities/${encodeURIComponent(entityId)}/accounts/${encodeURIComponent(accountId)}/cards/${encodeURIComponent(cardId)}`,
    );
  },

  freeze(entityId: string, accountId: string, cardId: string): Promise<IssuedCard> {
    return apiEnvelope(
      "POST",
      `/v1/entities/${encodeURIComponent(entityId)}/accounts/${encodeURIComponent(accountId)}/cards/${encodeURIComponent(cardId)}/freeze`,
      {},
    );
  },

  unfreeze(
    entityId: string,
    accountId: string,
    cardId: string,
  ): Promise<IssuedCard> {
    return apiEnvelope(
      "POST",
      `/v1/entities/${encodeURIComponent(entityId)}/accounts/${encodeURIComponent(accountId)}/cards/${encodeURIComponent(cardId)}/unfreeze`,
      {},
    );
  },
};
