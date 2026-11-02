/** Build partner payout preview bodies from discovery methods + form state. */

import { ApiRequestError } from "@/lib/apiClient";
import type { PayoutMethod } from "@/lib/services/payouts";

export type PayoutBankOption = {
  bank_code?: string;
  sort_code?: string;
  bank_name?: string;
  [key: string]: unknown;
};

export type PayoutBeneficiaryForm = {
  firstName: string;
  lastName: string;
  email: string;
  line1: string;
  city: string;
  postalCode: string;
  country: string;
};

/** Bank / Interac / SEPA / ACH / SWIFT fields keyed for the modal. */
export type PayoutBankForm = {
  bankCode: string;
  accountNumber: string;
  accountHolderName: string;
  email: string;
  iban: string;
  routingNumber: string;
  bankInstitutionNumber: string;
  transitNumber: string;
  swiftBic: string;
  bankName: string;
  accountType: string;
  country: string;
};

export type PayoutSecurityForm = {
  securityQuestion: string;
  securityAnswer: string;
};

export const EMPTY_PAYOUT_BANK_FORM: PayoutBankForm = {
  bankCode: "",
  accountNumber: "",
  accountHolderName: "",
  email: "",
  iban: "",
  routingNumber: "",
  bankInstitutionNumber: "",
  transitNumber: "",
  swiftBic: "",
  bankName: "",
  accountType: "checking",
  country: "",
};

const CURRENCY_COUNTRY: Record<string, string> = {
  KES: "KE",
  NGN: "NG",
  GHS: "GH",
  CAD: "CA",
  USD: "US",
  EUR: "",
  GBP: "",
  AED: "",
};

/** Discovery bank.* keys → form keys (excludes security_* which are top-level). */
const BANK_FIELD_TO_FORM: Record<string, keyof PayoutBankForm> = {
  bank_code: "bankCode",
  account_number: "accountNumber",
  account_holder_name: "accountHolderName",
  email: "email",
  iban: "iban",
  routing_number: "routingNumber",
  bank_institution_number: "bankInstitutionNumber",
  transit_number: "transitNumber",
  swift_bic: "swiftBic",
  bank_name: "bankName",
  account_type: "accountType",
  country: "country",
};

const FIELD_LABELS: Record<string, string> = {
  email: "Interac email",
  account_holder_name: "Account holder name",
  bank_name: "Bank name",
  account_number: "Account number",
  bank_code: "Bank",
  iban: "IBAN",
  routing_number: "Routing number",
  bank_institution_number: "Institution number (3 digits)",
  transit_number: "Transit number (5 digits)",
  swift_bic: "SWIFT / BIC",
  country: "Country (ISO)",
  account_type: "Account type",
  security_question: "Security question (optional)",
  security_answer: "Security answer (optional)",
};

export function normalizePayoutMethods(raw: unknown): PayoutMethod[] {
  if (Array.isArray(raw)) return raw as PayoutMethod[];
  if (raw && typeof raw === "object" && Array.isArray((raw as { methods?: unknown }).methods)) {
    return (raw as { methods: PayoutMethod[] }).methods;
  }
  return [];
}

export function normalizePayoutBanks(raw: unknown): PayoutBankOption[] {
  if (Array.isArray(raw)) return raw as PayoutBankOption[];
  if (raw && typeof raw === "object" && Array.isArray((raw as { banks?: unknown }).banks)) {
    return (raw as { banks: PayoutBankOption[] }).banks;
  }
  return [];
}

export function payoutMethodKey(method: PayoutMethod, index: number): string {
  return String(method.scheme || method.id || method.method || index);
}

export function payoutMethodLabel(method: PayoutMethod): string {
  if (method.label) return String(method.label);
  const scheme = String(method.scheme || method.method || method.id || "Payout");
  if (scheme === "ke_eft") return "Kenya bank transfer";
  if (scheme === "interac_email") return "Interac e-Transfer";
  if (scheme === "interac_account") return "Interac (account)";
  if (scheme === "eft") return "EFT";
  if (scheme === "nip") return "Nigeria bank (NIP)";
  if (scheme === "gh_eft") return "Ghana bank (EFT)";
  if (scheme === "sepa") return "SEPA";
  if (scheme === "ach") return "ACH";
  if (scheme === "wire") return "Wire";
  if (scheme === "swift") return "SWIFT";
  return scheme.replace(/_/g, " ");
}

export function methodRequiredFields(method: PayoutMethod): string[] {
  const raw = method.required_fields;
  return Array.isArray(raw) ? raw.map((f) => String(f)) : [];
}

export function methodOptionalFields(method: PayoutMethod): string[] {
  const raw = method.optional_fields;
  return Array.isArray(raw) ? raw.map((f) => String(f)) : [];
}

function methodRequireOneOf(method: PayoutMethod): string[][] {
  const raw = method.require_one_of;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((group): group is unknown[] => Array.isArray(group))
    .map((group) => group.map((f) => String(f)));
}

/** True when Aggregator discovery lists required_fields (scheme-aware body). */
export function usesSchemePayoutForm(method: PayoutMethod): boolean {
  return methodRequiredFields(method).length > 0;
}

/** Local bank-code rails (KES, NGN, GHS, …) need bank directory + beneficiary. */
export function usesBankCodePayoutForm(method: PayoutMethod): boolean {
  return methodRequiredFields(method).includes("bank_code");
}

export function payoutFieldLabel(field: string): string {
  return FIELD_LABELS[field] || field.replace(/_/g, " ");
}

export function payoutCountryForMethod(currency: string, method: PayoutMethod): string {
  const fromMethod = String(method.country || "").trim().toUpperCase();
  if (fromMethod.length === 2) return fromMethod;
  return (CURRENCY_COUNTRY[currency.toUpperCase()] || "").toUpperCase();
}

/**
 * Bank inputs to render for a method (required + require_one_of + selected optionals).
 * ``bank_code`` is rendered as the directory select in the modal.
 * ``country`` is omitted when discovery/currency already pins an ISO code.
 * Security Q&A are top-level and returned separately via ``methodSecurityFields``.
 */
export function methodBankInputFields(method: PayoutMethod, currency = ""): string[] {
  const pinnedCountry = payoutCountryForMethod(currency, method);
  const directory = usesBankCodePayoutForm(method);
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (field: string) => {
    if (field.startsWith("security_")) return;
    if (field === "country" && pinnedCountry.length === 2) return;
    // Directory select already carries bank_name for bank-code rails.
    if (field === "bank_name" && directory) return;
    if (!BANK_FIELD_TO_FORM[field] && field !== "bank_code") return;
    if (seen.has(field)) return;
    seen.add(field);
    out.push(field);
  };
  for (const f of methodRequiredFields(method)) push(f);
  for (const group of methodRequireOneOf(method)) {
    for (const f of group) push(f);
  }
  for (const f of methodOptionalFields(method)) {
    if (f === "swift_bic" || f === "account_type") push(f);
  }
  return out;
}

export function methodSecurityFields(method: PayoutMethod): string[] {
  return methodOptionalFields(method).filter(
    (f) => f === "security_question" || f === "security_answer",
  );
}

export function bankCodeFromOption(bank: PayoutBankOption): string {
  return String(bank.bank_code || bank.sort_code || "").trim();
}

export function kesPayoutMinAmountHint(currency: string): string | null {
  return currency.toUpperCase() === "KES" ? "Minimum payout amount is 5,000 KES." : null;
}

/** Fiat wallets where Send should open bank payout (not OffRamp send). */
const BANK_PAYOUT_SEND_CURRENCIES = new Set([
  "KES",
  "NGN",
  "GHS",
  "CAD",
  "USD",
  "EUR",
  "GBP",
  "AED",
]);

export function fiatSendOpensBankPayout(currency: string): boolean {
  return BANK_PAYOUT_SEND_CURRENCIES.has(currency.trim().toUpperCase());
}

function bankValue(form: PayoutBankForm, field: string, bankNameOverride?: string): string {
  if (field === "bank_name") {
    return (bankNameOverride || form.bankName || "").trim();
  }
  if (field === "bank_code") return form.bankCode.trim();
  const key = BANK_FIELD_TO_FORM[field];
  if (!key) return "";
  return String(form[key] ?? "").trim();
}

export function validateSchemePayoutFields(args: {
  method: PayoutMethod;
  beneficiary?: PayoutBeneficiaryForm;
  bank?: PayoutBankForm;
  bankName?: string;
  security?: PayoutSecurityForm;
}): string | null {
  if (!args.beneficiary || !args.bank) return "Recipient and bank details are required.";
  const ben = args.beneficiary;
  if (!ben.firstName.trim() || !ben.lastName.trim()) {
    return "Recipient first and last name are required.";
  }
  if (!ben.email.trim()) return "Recipient email is required.";
  if (!ben.line1.trim() || !ben.city.trim()) {
    return "Recipient address (street and city) is required.";
  }
  if (!ben.postalCode.trim()) return "Postal code is required.";

  for (const field of methodRequiredFields(args.method)) {
    if (field.startsWith("security_")) continue;
    if (field === "country") {
      const country =
        bankValue(args.bank, "country") ||
        ben.country.trim() ||
        payoutCountryForMethod("", args.method);
      if (!country) return "Country is required.";
      continue;
    }
    if (!bankValue(args.bank, field, args.bankName)) {
      return `${payoutFieldLabel(field)} is required.`;
    }
  }

  for (const group of methodRequireOneOf(args.method)) {
    const ok = group.some((field) => Boolean(bankValue(args.bank!, field, args.bankName)));
    if (!ok) {
      return `Provide ${group.map(payoutFieldLabel).join(" or ")}.`;
    }
  }

  const secFields = methodSecurityFields(args.method);
  if (secFields.includes("security_question") || secFields.includes("security_answer")) {
    const q = (args.security?.securityQuestion || "").trim();
    const a = (args.security?.securityAnswer || "").trim();
    if ((q && !a) || (!q && a)) {
      return "Security question and answer must both be set, or both left blank.";
    }
  }

  return null;
}

export function buildPayoutPreviewBody(args: {
  amount: string;
  currency: string;
  method: PayoutMethod;
  /** Index in discovery list — used when method has no scheme/id/method. */
  methodIndex: number;
  /** Simple corridor: email or account string (legacy Interac / placeholder). */
  simpleDestination?: string;
  beneficiary?: PayoutBeneficiaryForm;
  bank?: PayoutBankForm;
  bankName?: string;
  security?: PayoutSecurityForm;
}): Record<string, unknown> {
  const amount = args.amount.trim();
  const scheme = String(args.method.scheme || args.method.method || args.method.id || "").trim();

  if (usesSchemePayoutForm(args.method)) {
    const ben = args.beneficiary;
    const bank = args.bank;
    if (!ben || !bank) {
      throw new Error("Bank and beneficiary details are required.");
    }
    const country = (
      bank.country.trim() ||
      payoutCountryForMethod(args.currency, args.method) ||
      ben.country.trim()
    ).toUpperCase();

    const bankOut: Record<string, unknown> = {
      ...(scheme ? { scheme } : {}),
      account_holder_name: bank.accountHolderName.trim(),
      country,
    };

    const include = new Set<string>([
      ...methodRequiredFields(args.method),
      ...methodRequireOneOf(args.method).flat(),
      ...methodOptionalFields(args.method).filter((f) => f === "swift_bic" || f === "account_type"),
    ]);

    for (const field of include) {
      if (field === "country" || field === "account_holder_name" || field.startsWith("security_")) {
        continue;
      }
      const value = bankValue(bank, field, args.bankName);
      if (value) bankOut[field] = value;
    }

    // bank_name is required for most schemes; directory override for bank-code rails.
    if (include.has("bank_name") || args.bankName) {
      const name = (args.bankName || bank.bankName).trim();
      if (name) bankOut.bank_name = name;
    }

    const body: Record<string, unknown> = {
      amount,
      beneficiary: {
        first_name: ben.firstName.trim(),
        last_name: ben.lastName.trim(),
        email: ben.email.trim(),
        address: {
          line_1: ben.line1.trim(),
          city: ben.city.trim(),
          postal_code: ben.postalCode.trim(),
          country: ben.country.trim().toUpperCase() || country,
        },
      },
      bank: bankOut,
    };

    const q = (args.security?.securityQuestion || "").trim();
    const a = (args.security?.securityAnswer || "").trim();
    if (q && a) {
      body.security_question = q;
      body.security_answer = a;
    }
    return body;
  }

  const dest = (args.simpleDestination || "").trim();
  return {
    amount,
    currency: args.currency,
    method: payoutMethodKey(args.method, args.methodIndex),
    destination: { account: dest },
  };
}

export function payoutTotalDebit(preview: Record<string, unknown>): unknown {
  return preview.total_debit ?? preview.balance_required;
}

function minAmountFromErrorData(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const row = data as Record<string, unknown>;
  const direct = row.min_amount;
  if (direct != null && String(direct).trim()) return String(direct).trim();
  const nested = row.data;
  if (nested && typeof nested === "object") {
    const inner = (nested as Record<string, unknown>).min_amount;
    if (inner != null && String(inner).trim()) return String(inner).trim();
  }
  return null;
}

/** User-facing payout error; surfaces Mboka ``data.min_amount`` when present. */
export function payoutApiErrorMessage(err: unknown, currency: string): string {
  if (err instanceof ApiRequestError) {
    const min = minAmountFromErrorData(err.data);
    if (min) {
      const ccy = currency.trim().toUpperCase();
      return ccy ? `Minimum payout amount is ${min} ${ccy}.` : `Minimum payout amount is ${min}.`;
    }
    if (err.message.trim()) return err.message;
  }
  if (err instanceof Error && err.message.trim()) return err.message;
  return "Something went wrong. Try again.";
}

export function bankOptionLabel(bank: PayoutBankOption, index: number): string {
  const code = bankCodeFromOption(bank);
  const name = String(bank.bank_name || "").trim();
  if (name && code) return `${name} (${code})`;
  return name || code || `Bank ${index + 1}`;
}

/** Short review-line summary of the destination. */
export function payoutDestinationSummary(args: {
  method: PayoutMethod;
  bank: PayoutBankForm;
  bankName?: string;
  simpleDestination?: string;
  previewDestination?: unknown;
}): string {
  if (!usesSchemePayoutForm(args.method)) {
    return String(args.previewDestination || args.simpleDestination || "");
  }
  const email = args.bank.email.trim();
  if (email) return email;
  const iban = args.bank.iban.trim();
  if (iban) return iban;
  const acct = args.bank.accountNumber.trim();
  const name = (args.bankName || args.bank.bankName || "").trim();
  if (name && acct) return `${name} · ${acct}`;
  if (acct) return acct;
  return payoutMethodLabel(args.method);
}
