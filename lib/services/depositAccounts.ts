import { apiEnvelope } from "@/lib/apiClient";

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

export type StablecoinOption = { code: string; label: string };
export type NetworkOption = { code: string; label: string };

export const STABLECOIN_OPTIONS: StablecoinOption[] = [
  { code: "USDC", label: "USD Coin (USDC)" },
  { code: "USDT", label: "Tether (USDT)" },
];

export const NETWORK_OPTIONS: NetworkOption[] = [
  { code: "POLYGON", label: "Polygon" },
  { code: "BASE", label: "Base" },
  { code: "ETHEREUM", label: "Ethereum" },
];

export type DepositAccount = {
  currency: string;
  account_number?: string | null;
  iban?: string | null;
  bank_name?: string | null;
  account_holder_name?: string | null;
  [key: string]: unknown;
};

export type DepositAccountEligibility = {
  eligible: boolean;
  verification_status: string;
};

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
    apiEnvelope<{ accounts: DepositAccount[] }>("GET", "/v1/iban/accounts"),
  create: (input: CreateBankAccountInput) =>
    apiEnvelope<DepositAccount>(
      "POST",
      "/v1/iban/accounts",
      buildCreateBankAccountPayload(input),
    ),
};
