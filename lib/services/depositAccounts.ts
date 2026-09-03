import { apiEnvelope } from "@/lib/apiClient";
import { formatAccountBalance, pickAvailableBalance } from "@/lib/services/balances";

/**
 * Deposit ("currency") accounts — IBAN/bank coordinates issued by the provider.
 *
 * `POST /v1/iban/accounts` accepts **EUR and USD only** today
 * (`DepositAccountCreateIn._currency_allowed` in the backend). The Add Account
 * design lists many more, so the extras are rendered but disabled rather than
 * offered and then rejected — inviting a click that can only fail is worse
 * than showing the limit up front.
 */
export const SUPPORTED_IBAN_CURRENCIES = ["USD", "EUR"] as const;

export type CurrencyOption = {
  code: string;
  label: string;
  iso: string; // 2-letter, for the flag image
};

/** Order mirrors the Add Account mockup. */
export const CURRENCY_OPTIONS: CurrencyOption[] = [
  { code: "USD", label: "US Dollar", iso: "us" },
  { code: "EUR", label: "Euro", iso: "eu" },
  { code: "GBP", label: "Pound Sterling", iso: "gb" },
  { code: "ZAR", label: "South African Rand", iso: "za" },
  { code: "CAD", label: "Canadian Dollar", iso: "ca" },
  { code: "AED", label: "UAE Dirham", iso: "ae" },
  { code: "NGN", label: "Nigerian Naira", iso: "ng" },
  { code: "GHS", label: "Ghanaian Cedi", iso: "gh" },
  { code: "KES", label: "Kenyan Shilling", iso: "ke" },
  { code: "TZS", label: "Tanzanian Shilling", iso: "tz" },
  { code: "AUD", label: "Australian Dollar", iso: "au" },
];

export function isCurrencySupported(code: string): boolean {
  return (SUPPORTED_IBAN_CURRENCIES as readonly string[]).includes(
    code.trim().toUpperCase(),
  );
}

/**
 * ISO currencies that already have a listed fiat deposit account.
 * Create is create-or-refresh upstream — UI should not look like a second issue.
 */
export function occupiedFiatCurrencyCodes(
  accounts: Array<{ currency?: string | null }>,
): Set<string> {
  const occupied = new Set<string>();
  for (const account of accounts) {
    const code = (account.currency || "").trim().toUpperCase();
    if (code) occupied.add(code);
  }
  return occupied;
}

export function isFiatCurrencyOccupied(
  accounts: Array<{ currency?: string | null }>,
  currencyCode: string,
): boolean {
  const code = currencyCode.trim().toUpperCase();
  if (!code) return false;
  return occupiedFiatCurrencyCodes(accounts).has(code);
}

/** Flag-image ISO for a currency code, for the same chip/card UI used elsewhere. */
export function currencyIso(code: string | null | undefined): string | null {
  if (!code) return null;
  const norm = code.trim().toUpperCase();
  return CURRENCY_OPTIONS.find((c) => c.code === norm)?.iso ?? null;
}

/** Human label for a currency code, falling back to the raw code. */
export function currencyLabel(code: string | null | undefined): string {
  if (!code) return "—";
  const norm = code.trim().toUpperCase();
  return CURRENCY_OPTIONS.find((c) => c.code === norm)?.label ?? norm;
}

export type StablecoinOption = { code: string; label: string };
export type NetworkOption = { code: string; label: string };

export const STABLECOIN_OPTIONS: StablecoinOption[] = [
  { code: "USDC", label: "USD Coin (USDC)" },
  { code: "USDT", label: "Tether (USDT)" },
];

/** Custodial create/send: USDC on Base/Polygon/Stellar; USDT on Base/Polygon only. */
export const SUPPORTED_STABLECOINS = ["USDC", "USDT"] as const;

export function isStablecoinSupported(code: string): boolean {
  return (SUPPORTED_STABLECOINS as readonly string[]).includes(
    code.trim().toUpperCase(),
  );
}

export const NETWORK_OPTIONS: NetworkOption[] = [
  { code: "STELLAR", label: "Stellar" },
  { code: "POLYGON", label: "Polygon" },
  { code: "BASE", label: "Base" },
  { code: "ETHEREUM", label: "Ethereum" },
];

/** Networks currently available for custodial stablecoin account creation. */
export const SUPPORTED_STABLECOIN_NETWORKS = ["BASE", "POLYGON", "STELLAR"] as const;

/** EVM networks that support both USDC and USDT. Stellar is USDC-only. */
export const EVM_STABLECOIN_NETWORKS = ["BASE", "POLYGON"] as const;

export function isStablecoinNetworkSupported(code: string): boolean {
  return (SUPPORTED_STABLECOIN_NETWORKS as readonly string[]).includes(
    code.trim().toUpperCase(),
  );
}

/** Networks allowed for a given stablecoin when creating/sending. */
export function networksForStablecoin(currency: string): readonly string[] {
  const code = currency.trim().toUpperCase();
  if (code === "USDT") return EVM_STABLECOIN_NETWORKS;
  if (code === "USDC") return SUPPORTED_STABLECOIN_NETWORKS;
  return [];
}

/** Every creatable (currency, network) slot. */
export function allSupportedStablecoinSlots(): { currency: string; network: string }[] {
  return SUPPORTED_STABLECOINS.flatMap((currency) =>
    networksForStablecoin(currency).map((network) => ({ currency, network })),
  );
}

export function isStablecoinSlotSupported(currency: string, network: string): boolean {
  return networksForStablecoin(currency).includes(network.trim().toUpperCase());
}

/**
 * Mirrors the backend's `DepositAccountOut` (`app/schema/deposit_accounts.py`).
 * `balance` is optional — partner fiat rails (e.g. Nuvion) return it on
 * `GET /partner/entities/{id}/accounts`; older responses omit it.
 */
export type DepositAccountStatus = "active" | "pending" | "unavailable";

export type DepositAccountBalance = {
  available?: string | null;
  current?: string | null;
  currency?: string | null;
};

export type DepositAccount = {
  id?: string | null;
  /** Partner entity id that owns this deposit account (Cards / nested routes). */
  entity_id?: string | null;
  currency: string;
  status: DepositAccountStatus;
  account_holder_name?: string | null;
  iban?: string | null;
  bic?: string | null;
  bank_name?: string | null;
  bank_address?: Record<string, unknown> | null;
  reference?: string | null;
  destination_wallet?: string | null;
  destination_asset?: string | null;
  destination_network?: string | null;
  instructions?: string | null;
  last_updated_at?: string | null;
  balance?: DepositAccountBalance | null;
};

function nonEmpty(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

/** Flatten a partner bank_address object into one display line; omit if empty. */
export function formatBankAddress(
  address: Record<string, unknown> | null | undefined,
): string | null {
  if (!address || typeof address !== "object") return null;
  const preferred = [
    "line1",
    "line2",
    "street",
    "address",
    "city",
    "state",
    "region",
    "postal_code",
    "postcode",
    "zip",
    "country",
  ];
  const seen = new Set<string>();
  const parts: string[] = [];
  for (const key of preferred) {
    const value = nonEmpty(address[key]);
    if (!value) continue;
    const norm = value.toLowerCase();
    if (seen.has(norm)) continue;
    seen.add(norm);
    parts.push(value);
  }
  if (!parts.length) {
    for (const value of Object.values(address)) {
      const text = nonEmpty(value);
      if (!text) continue;
      const norm = text.toLowerCase();
      if (seen.has(norm)) continue;
      seen.add(norm);
      parts.push(text);
    }
  }
  return parts.length ? parts.join(", ") : null;
}

/**
 * Overlay a fuller `GET /v1/iban/accounts` row onto a bootstrap stub.
 * Non-empty overlay fields win; missing overlay fields keep the stub.
 */
export function mergeDepositAccount(
  stub: DepositAccount | null | undefined,
  overlay: DepositAccount | null | undefined,
): DepositAccount | null {
  if (!stub && !overlay) return null;
  if (!overlay) return stub ?? null;
  if (!stub) return overlay;
  const merged: DepositAccount = { ...stub };
  (Object.keys(overlay) as (keyof DepositAccount)[]).forEach((key) => {
    const next = overlay[key];
    if (next == null) return;
    if (typeof next === "string" && !next.trim()) return;
    (merged as Record<string, unknown>)[key as string] = next;
  });
  return merged;
}

export type DepositAccountListResult = {
  accounts: DepositAccount[];
  /** Present once Mboka soft-fails KYB on the list endpoint (HTTP 200). */
  eligible?: boolean;
  verification_status?: string | null;
};

export type DepositAccountEligibility = {
  eligible: boolean;
  verification_status: string;
};

const STATUS_LABELS: Record<DepositAccountStatus, string> = {
  active: "Active",
  pending: "Pending",
  unavailable: "Unavailable",
};

export function describeDepositAccountStatus(status: string | null | undefined): string {
  if (!status) return "Unknown";
  return STATUS_LABELS[status as DepositAccountStatus] ?? status;
}

/**
 * Groups a cleaned alphanumeric string into 4-character blocks, e.g. for
 * partial-IBAN display (`DE89 3704 ·· 4210`).
 */
function groupInFours(value: string): string {
  return value.match(/.{1,4}/g)?.join(" ") ?? value;
}

/**
 * Masks a long account identifier (IBAN, account number) down to its first
 * 8 and last 4 characters, matching the display style used elsewhere in the
 * dashboard's account cards. Short values are shown in full (grouped), since
 * there's nothing meaningful left to hide.
 */
export function maskAccountIdentifier(raw: string | null | undefined): string {
  if (!raw) return "—";
  const clean = raw.replace(/\s+/g, "").toUpperCase();
  if (clean.length <= 12) return groupInFours(clean);
  const head = groupInFours(clean.slice(0, 8));
  const tail = clean.slice(-4);
  return `${head} ·· ${tail}`;
}

export type DepositAccountCardView = {
  currency: string;
  name: string;
  iso: string | null;
  status: DepositAccountStatus;
  statusLabel: string;
  /** Masked IBAN/account number, or a fallback when coordinates aren't issued yet. */
  primaryDetail: string;
  /** Bank name / BIC, when available — secondary line under the primary detail. */
  secondaryDetail: string;
  /** Formatted available balance, or `—` when the partner did not return one. */
  balance: string;
  /** True when `balance` came from the partner (not a placeholder). */
  hasBalance: boolean;
};

/**
 * Format partner `balance.available` (preferred) or `balance.current` for UI.
 * Returns `—` when missing/unparseable — never invents a figure.
 */
export function formatDepositAccountBalance(
  account: Pick<DepositAccount, "currency" | "balance">,
): string {
  return formatAccountBalance(account.balance);
}

/**
 * Pure mapper from a raw `DepositAccountOut` to display-ready card fields.
 */
export function mapDepositAccountToCardView(account: DepositAccount): DepositAccountCardView {
  const primaryDetail = account.iban
    ? maskAccountIdentifier(account.iban)
    : account.bank_name || account.instructions || "Coordinates pending";
  const secondaryDetail = [account.bic, account.account_holder_name]
    .filter((v): v is string => Boolean(v))
    .join(" · ");
  const balance = formatDepositAccountBalance(account);
  return {
    currency: account.currency,
    name: currencyLabel(account.currency),
    iso: currencyIso(account.currency),
    status: account.status,
    statusLabel: describeDepositAccountStatus(account.status),
    primaryDetail,
    secondaryDetail,
    balance,
    hasBalance: balance !== "—",
  };
}

export type DepositAccountDetailRow = {
  label: string;
  value: string;
  copyValue?: string;
};

/**
 * Pure mapper from a raw `DepositAccountOut` to the rows shown in the
 * account-detail modal. Omits any field the backend didn't return rather
 * than rendering an empty/placeholder row for it.
 */
export function buildDepositAccountDetailRows(account: DepositAccount): DepositAccountDetailRow[] {
  const rows: DepositAccountDetailRow[] = [];
  const iban = nonEmpty(account.iban);
  const bic = nonEmpty(account.bic);
  const bankName = nonEmpty(account.bank_name);
  const holder = nonEmpty(account.account_holder_name);
  const reference = nonEmpty(account.reference);
  const wallet = nonEmpty(account.destination_wallet);
  const bankAddress = formatBankAddress(account.bank_address);
  if (iban) rows.push({ label: "IBAN", value: iban, copyValue: iban });
  if (bic) rows.push({ label: "BIC / SWIFT", value: bic, copyValue: bic });
  if (bankName) rows.push({ label: "Bank", value: bankName, copyValue: bankName });
  if (bankAddress) rows.push({ label: "Bank address", value: bankAddress, copyValue: bankAddress });
  if (holder) rows.push({ label: "Account name", value: holder, copyValue: holder });
  if (reference) {
    rows.push({ label: "Reference", value: reference, copyValue: reference });
  }
  // Format through the shared helper so the detail row and the card view
  // never disagree (raw `25` vs formatted `25.00`) on the same account.
  if (pickAvailableBalance(account.balance)) {
    rows.push({
      label: "Available balance",
      value: `${formatAccountBalance(account.balance)} ${account.balance?.currency || account.currency}`,
    });
  }
  if (wallet) {
    rows.push({
      label: "Settles to wallet",
      value: wallet,
      copyValue: wallet,
    });
  }
  const asset = nonEmpty(account.destination_asset);
  const network = nonEmpty(account.destination_network);
  if (asset || network) {
    const parts = [asset, network].filter((part): part is string => Boolean(part));
    rows.push({ label: "Settlement asset", value: parts.join(" · ") });
  }
  return rows;
}

export type CreateBankAccountInput = {
  currency: string;
  /**
   * Label the user typed. The API has no name field yet, so this is not sent —
   * see `buildCreateBankAccountPayload`.
   */
  accountName?: string;
  walletAddress?: string;
};

/**
 * Build the create-account request body.
 *
 * Deliberately omits the account name: `DepositAccountCreateIn` has no such
 * field and Pydantic drops unknown keys, so sending it would look like it
 * saved while silently discarding it.
 */
export function buildCreateBankAccountPayload(input: CreateBankAccountInput) {
  const currency = input.currency.trim().toUpperCase();
  if (!currency) throw new Error("Choose a currency for the account.");
  if (!isCurrencySupported(currency)) {
    throw new Error(
      `${currency} accounts aren't available yet — currently EUR and USD only.`,
    );
  }
  const body: { currency: string; wallet_address?: string } = { currency };
  if (input.walletAddress) body.wallet_address = input.walletAddress;
  return body;
}

export const depositAccountsApi = {
  eligibility: () =>
    apiEnvelope<DepositAccountEligibility>(
      "GET",
      "/v1/iban/accounts/eligibility",
    ),
  list: () =>
    apiEnvelope<DepositAccountListResult>("GET", "/v1/iban/accounts"),
  create: (input: CreateBankAccountInput) =>
    apiEnvelope<DepositAccount>(
      "POST",
      "/v1/iban/accounts",
      buildCreateBankAccountPayload(input),
    ),
};
