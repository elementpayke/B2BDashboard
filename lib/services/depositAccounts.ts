import { apiEnvelope } from "@/lib/apiClient";
import { isAllowlistedStellarStable } from "@/lib/config/stellarFeatures";
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
  iso: string | null; // 2-letter, for the flag image — null when unknown
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
  // Rest of Nuvion's Add Account list (same order as app.nuvion.co). Only
  // selectable once eligibility `supported_accounts` lists them.
  { code: "NZD", label: "New Zealand Dollar", iso: "nz" },
  { code: "JPY", label: "Japanese Yen", iso: "jp" },
  { code: "CNY", label: "Chinese Yuan", iso: "cn" },
  { code: "HKD", label: "Hong Kong Dollar", iso: "hk" },
  { code: "ILS", label: "Israeli New Shekel", iso: "il" },
  { code: "MXN", label: "Mexican Peso", iso: "mx" },
  { code: "SEK", label: "Swedish Krona", iso: "se" },
  { code: "CHF", label: "Swiss Franc", iso: "ch" },
  { code: "NOK", label: "Norwegian Krone", iso: "no" },
  { code: "DKK", label: "Danish Krone", iso: "dk" },
  { code: "SGD", label: "Singapore Dollar", iso: "sg" },
  { code: "KRW", label: "South Korean Won", iso: "kr" },
  { code: "THB", label: "Thai Baht", iso: "th" },
  { code: "HUF", label: "Hungarian Forint", iso: "hu" },
  { code: "PLN", label: "Polish Zloty", iso: "pl" },
  { code: "RON", label: "Romanian Leu", iso: "ro" },
  { code: "CZK", label: "Czech Koruna", iso: "cz" },
  { code: "XOF", label: "West African CFA Franc", iso: null },
  { code: "XAF", label: "Central African CFA Franc", iso: null },
];

export function isCurrencySupported(
  code: string,
  supportedCurrencies: readonly string[] = SUPPORTED_IBAN_CURRENCIES,
): boolean {
  return supportedCurrencies.includes(code.trim().toUpperCase());
}

/**
 * One entry per currency/country/rail the backend currently allows this
 * business to open — from `GET /v1/iban/accounts/eligibility`. Absent/empty
 * on today's backend; the dashboard falls back to `SUPPORTED_IBAN_CURRENCIES`
 * until a Nuvion-backed rail beyond USD/EUR ships.
 */
export type SupportedAccountDescriptor = {
  currency: string;
  country_code?: string | null;
  rail_type: string;
  fields: string[];
  label?: string | null;
  monthly_maintenance_fee?: { amount: string; currency: string } | null;
};

/**
 * Resolves the live, backend-declared currency list, additive on top of the
 * static `SUPPORTED_IBAN_CURRENCIES` constant — this is what lets new
 * currencies appear with no frontend redeploy once backend adds them.
 *
 * `supported_accounts` is backend-declared *extra* rails, not the full list:
 * the backend's own `supported_rails.py` docstring is explicit that it "only
 * lists a rail ... beyond the EUR/USD the dashboard currently hardcodes."
 * Treating it as a replacement (as an earlier revision of this function did)
 * silently dropped USD/EUR from the Add Account picker the moment the
 * backend shipped its first additional rail (GBP) — confirmed live
 * 2026-10-13: a business with an open USD account saw Bank account creation
 * gated off entirely once `supported_accounts: [GBP]` started arriving.
 */
export function supportedCurrenciesFromEligibility(
  eligibility: DepositAccountEligibility | null | undefined,
): readonly string[] {
  const codes: string[] = [...SUPPORTED_IBAN_CURRENCIES];
  for (const descriptor of eligibility?.supported_accounts ?? []) {
    const code = (descriptor?.currency || "").trim().toUpperCase();
    if (code && !codes.includes(code)) codes.push(code);
  }
  return codes;
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

/**
 * `CURRENCY_OPTIONS` plus a synthetic entry (raw code as its own label, no
 * flag) for any backend-declared currency this dashboard has no display
 * metadata for yet — so a brand-new Nuvion-backed currency still renders in
 * the picker instead of being silently dropped.
 */
export function currencyOptionsFor(supportedCurrencies: readonly string[]): CurrencyOption[] {
  const known = new Set(CURRENCY_OPTIONS.map((c) => c.code));
  const extras: CurrencyOption[] = [];
  for (const raw of supportedCurrencies) {
    const code = raw.trim().toUpperCase();
    if (!code || known.has(code)) continue;
    known.add(code);
    extras.push({ code, label: code, iso: null });
  }
  return extras.length ? [...CURRENCY_OPTIONS, ...extras] : CURRENCY_OPTIONS;
}

export type StablecoinOption = { code: string; label: string };
export type NetworkOption = { code: string; label: string };

export const STABLECOIN_OPTIONS: StablecoinOption[] = [
  { code: "USDC", label: "USD Coin (USDC)" },
  { code: "USDT", label: "Tether (USDT)" },
  { code: "EURC", label: "EURC" },
];

/** Custodial create: USDC everywhere, plus allowlisted Stellar-only stables. */
export const SUPPORTED_STABLECOINS = ["USDC", "USDT", "EURC"] as const;

export function isStablecoinSupported(code: string): boolean {
  return networksForStablecoin(code).length > 0;
}

export const NETWORK_OPTIONS: NetworkOption[] = [
  { code: "STELLAR", label: "Stellar" },
  { code: "POLYGON", label: "Polygon" },
  { code: "BASE", label: "Base" },
  { code: "ETHEREUM", label: "Ethereum" },
];

/** Networks currently available for custodial stablecoin account creation. */
export const SUPPORTED_STABLECOIN_NETWORKS = ["BASE", "POLYGON", "STELLAR"] as const;

/** EVM networks that support both USDC and USDT. */
export const EVM_STABLECOIN_NETWORKS = ["BASE", "POLYGON"] as const;

export function isStablecoinNetworkSupported(code: string): boolean {
  return (SUPPORTED_STABLECOIN_NETWORKS as readonly string[]).includes(
    code.trim().toUpperCase(),
  );
}

/** Networks allowed for a given stablecoin when creating/sending. */
export function networksForStablecoin(currency: string): readonly string[] {
  const code = currency.trim().toUpperCase();
  if (code === "USDT") {
    return isAllowlistedStellarStable(code)
      ? SUPPORTED_STABLECOIN_NETWORKS
      : EVM_STABLECOIN_NETWORKS;
  }
  // Stellar is USDC's only home wallet — Base/Polygon are bridge networks
  // (CCTP), not separate accounts you can open or send an existing balance
  // from directly.
  if (code === "USDC") return ["STELLAR"];
  if (isAllowlistedStellarStable(code)) return ["STELLAR"];
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
export type DepositAccountStatus =
  | "active"
  | "pending"
  | "unavailable"
  | "deposit_unavailable";

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
  /** US ACH/wire routing number. Distinct from `bic` — USD accounts only. */
  routing_number?: string | null;
  /** Generic local account number for non-IBAN rails (UK, Canada, Ghana, ...). */
  account_number?: string | null;
  /** UK local bank rail. */
  sort_code?: string | null;
  /** Canadian local bank rail — always paired with `transit_number`. */
  institution_number?: string | null;
  transit_number?: string | null;
  /** Ghana and similar local bank rails. */
  bank_code?: string | null;
  /** Mexico. */
  clabe?: string | null;
  bank_name?: string | null;
  bank_address?: Record<string, unknown> | null;
  reference?: string | null;
  destination_wallet?: string | null;
  destination_asset?: string | null;
  destination_network?: string | null;
  instructions?: string | null;
  last_updated_at?: string | null;
  balance?: DepositAccountBalance | null;
  /** Recurring charge for holding this account. Not available from Nuvion's
   * API today (only a boolean opt-out flag exists there) — this is Mboka's
   * own fee-schedule config once it ships. */
  monthly_maintenance_fee?: { amount: string; currency: string } | null;
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
  /** Live currency/rail list — see `SupportedAccountDescriptor`. */
  supported_accounts?: SupportedAccountDescriptor[];
};

const STATUS_LABELS: Record<DepositAccountStatus, string> = {
  active: "Active",
  pending: "Pending",
  unavailable: "Unavailable",
  deposit_unavailable: "Unavailable",
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
    : account.status === "deposit_unavailable" || account.status === "unavailable"
      ? "Deposit rail unavailable"
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
/**
 * Routing/identifier fields in display order. One map entry per field is all
 * a new local bank rail needs — no per-currency branch required.
 */
const IDENTIFIER_FIELDS: Array<{ field: keyof DepositAccount; label: string }> = [
  { field: "iban", label: "IBAN" },
  { field: "bic", label: "BIC / SWIFT" },
  { field: "routing_number", label: "Routing number" },
  { field: "sort_code", label: "Sort code" },
  { field: "institution_number", label: "Institution number" },
  { field: "transit_number", label: "Transit number" },
  { field: "bank_code", label: "Bank code" },
  { field: "clabe", label: "CLABE" },
  { field: "account_number", label: "Account number" },
];

/**
 * True IBANs start with a 2-letter country code + 2 check digits (ISO 13616).
 * Cross River Bank's USD rail reuses the `iban` field for a plain US account
 * number (digits only) — label that "Account number" instead of "IBAN" so
 * the on-screen rows and the bank letter don't claim a format the value
 * isn't actually in.
 */
function isIbanFormat(value: string): boolean {
  return /^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/i.test(value.replace(/\s+/g, ""));
}

function formatMonthlyFee(
  fee: DepositAccount["monthly_maintenance_fee"] | undefined,
): string | null {
  if (!fee) return null;
  const amount = nonEmpty(fee.amount);
  const currency = nonEmpty(fee.currency);
  if (!amount) return null;
  return currency ? `${amount} ${currency}/month` : `${amount}/month`;
}

export function buildDepositAccountDetailRows(account: DepositAccount): DepositAccountDetailRow[] {
  const rows: DepositAccountDetailRow[] = [];
  for (const { field, label } of IDENTIFIER_FIELDS) {
    const value = nonEmpty(account[field] as string | null | undefined);
    if (!value) continue;
    const resolvedLabel = field === "iban" && !isIbanFormat(value) ? "Account number" : label;
    rows.push({ label: resolvedLabel, value, copyValue: value });
  }
  const bankName = nonEmpty(account.bank_name);
  const holder = nonEmpty(account.account_holder_name);
  const reference = nonEmpty(account.reference);
  const wallet = nonEmpty(account.destination_wallet);
  const bankAddress = formatBankAddress(account.bank_address);
  if (bankName) rows.push({ label: "Bank", value: bankName, copyValue: bankName });
  if (bankAddress) rows.push({ label: "Bank address", value: bankAddress, copyValue: bankAddress });
  if (holder) rows.push({ label: "Account name", value: holder, copyValue: holder });
  if (reference) {
    rows.push({ label: "Reference", value: reference, copyValue: reference });
  }
  const monthlyFee = formatMonthlyFee(account.monthly_maintenance_fee);
  if (monthlyFee) {
    rows.push({ label: "Monthly fee", value: monthlyFee });
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

export type DepositAccountDetailSection = {
  title: string;
  rows: DepositAccountDetailRow[];
};

const BANK_ROW_LABEL_RE =
  /^(iban|bic|swift|bank|account name|account number|routing number|sort code|institution number|transit number|bank code|clabe)/i;

/**
 * Field-driven grouping for the account-detail modal and bank letter.
 *
 * `routing_number` is the signal — not currency — that an account needs the
 * two-rail breakdown a US-style bank actually requires (domestic ACH/wire
 * needs the routing number; international wire needs SWIFT/BIC instead),
 * since the same account number pairs with a different second identifier
 * depending on which rail the sender uses. No other rail in use today pairs
 * a routing number with an optional SWIFT/BIC, so this generalizes safely:
 * every other currency/rail (IBAN+BIC, UK sort code, local bank fields, ...)
 * keeps a single "Bank details" grouping — its one identifier already fully
 * describes the account on its own.
 */
export function buildDepositAccountDetailSections(
  account: DepositAccount,
): DepositAccountDetailSection[] {
  const rows = buildDepositAccountDetailRows(account);
  const bankRows = rows.filter((r) => BANK_ROW_LABEL_RE.test(r.label));
  const otherRows = rows.filter((r) => !BANK_ROW_LABEL_RE.test(r.label));
  const sections: DepositAccountDetailSection[] = [];

  const iban = nonEmpty(account.iban);
  const bic = nonEmpty(account.bic);
  const routingNumber = nonEmpty(account.routing_number);
  const bankName = nonEmpty(account.bank_name);
  const bankAddress = formatBankAddress(account.bank_address);

  if (iban && routingNumber) {
    const domestic: DepositAccountDetailRow[] = [
      { label: "Account number", value: iban, copyValue: iban },
      { label: "Routing number", value: routingNumber, copyValue: routingNumber },
    ];
    if (bankName) domestic.push({ label: "Bank", value: bankName, copyValue: bankName });
    if (bankAddress) {
      domestic.push({ label: "Bank address", value: bankAddress, copyValue: bankAddress });
    }
    sections.push({ title: "Domestic transfer (ACH/wire)", rows: domestic });
    if (bic) {
      const international: DepositAccountDetailRow[] = [
        { label: "Account number", value: iban, copyValue: iban },
        { label: "SWIFT/BIC", value: bic, copyValue: bic },
      ];
      if (bankName) international.push({ label: "Bank", value: bankName, copyValue: bankName });
      if (bankAddress) {
        international.push({ label: "Bank address", value: bankAddress, copyValue: bankAddress });
      }
      sections.push({ title: "International wire", rows: international });
    }
  } else if (bankRows.length) {
    sections.push({ title: "Bank details", rows: bankRows });
  }

  if (otherRows.length) sections.push({ title: "Settlement", rows: otherRows });
  return sections;
}

export type CreateBankAccountInput = {
  currency: string;
  /**
   * Label the user typed. The API has no name field yet, so this is not sent —
   * see `buildCreateBankAccountPayload`.
   */
  accountName?: string;
  walletAddress?: string;
  /** Only sent when the chosen currency's descriptor declares a country —
   * most currencies map to exactly one country and don't need this. */
  countryCode?: string;
};

/**
 * Build the create-account request body.
 *
 * Deliberately omits the account name: `DepositAccountCreateIn` has no such
 * field and Pydantic drops unknown keys, so sending it would look like it
 * saved while silently discarding it.
 *
 * `supportedCurrencies` defaults to the static USD/EUR constant; callers
 * with live eligibility data should pass the resolved list from
 * `supportedCurrenciesFromEligibility` instead.
 */
export function buildCreateBankAccountPayload(
  input: CreateBankAccountInput,
  supportedCurrencies: readonly string[] = SUPPORTED_IBAN_CURRENCIES,
) {
  const currency = input.currency.trim().toUpperCase();
  if (!currency) throw new Error("Choose a currency for the account.");
  if (!isCurrencySupported(currency, supportedCurrencies)) {
    throw new Error(`${currency} accounts aren't available yet.`);
  }
  const body: { currency: string; wallet_address?: string; country_code?: string } = {
    currency,
  };
  if (input.walletAddress) body.wallet_address = input.walletAddress;
  if (input.countryCode) body.country_code = input.countryCode;
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
  create: (input: CreateBankAccountInput, supportedCurrencies?: readonly string[]) =>
    apiEnvelope<DepositAccount>(
      "POST",
      "/v1/iban/accounts",
      buildCreateBankAccountPayload(input, supportedCurrencies),
    ),
  /**
   * On-demand sync: queries Nuvion live and reconciles Mboka's/the
   * aggregator's stored copy if stale, returning the refreshed account.
   * Endpoint doesn't exist yet — this is the frontend contract for it.
   */
  sync: (accountId: string) =>
    apiEnvelope<DepositAccount>(
      "POST",
      `/v1/iban/accounts/${encodeURIComponent(accountId)}/sync`,
    ),
};
