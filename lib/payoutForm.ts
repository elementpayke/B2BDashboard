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

export type PayoutBankForm = {
  bankCode: string;
  accountNumber: string;
  accountHolderName: string;
};

const CURRENCY_COUNTRY: Record<string, string> = {
  KES: "KE",
  NGN: "NG",
  GHS: "GH",
  CAD: "CA",
  USD: "US",
  EUR: "",
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
  if (scheme === "nip") return "Nigeria bank (NIP)";
  if (scheme === "gh_eft") return "Ghana bank (EFT)";
  return scheme.replace(/_/g, " ");
}

function requiredFields(method: PayoutMethod): string[] {
  const raw = method.required_fields;
  return Array.isArray(raw) ? raw.map((f) => String(f)) : [];
}

/** Local bank-code rails (KES, NGN, GHS, …) need bank directory + beneficiary. */
export function usesBankCodePayoutForm(method: PayoutMethod): boolean {
  return requiredFields(method).includes("bank_code");
}

export function payoutCountryForMethod(currency: string, method: PayoutMethod): string {
  const fromMethod = String(method.country || "").trim().toUpperCase();
  if (fromMethod.length === 2) return fromMethod;
  return (CURRENCY_COUNTRY[currency.toUpperCase()] || "").toUpperCase();
}

export function bankCodeFromOption(bank: PayoutBankOption): string {
  return String(bank.bank_code || bank.sort_code || "").trim();
}

export function kesPayoutMinAmountHint(currency: string): string | null {
  return currency.toUpperCase() === "KES" ? "Minimum payout amount is 5,000 KES." : null;
}

/** Fiat wallets where Send should open bank payout (not OffRamp send). */
const BANK_PAYOUT_SEND_CURRENCIES = new Set(["KES", "NGN", "GHS"]);

export function fiatSendOpensBankPayout(currency: string): boolean {
  return BANK_PAYOUT_SEND_CURRENCIES.has(currency.trim().toUpperCase());
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
}): Record<string, unknown> {
  const amount = args.amount.trim();
  const scheme = String(args.method.scheme || args.method.method || args.method.id || "").trim();

  if (usesBankCodePayoutForm(args.method)) {
    const ben = args.beneficiary;
    const bank = args.bank;
    const country = payoutCountryForMethod(args.currency, args.method);
    if (!ben || !bank) {
      throw new Error("Bank and beneficiary details are required.");
    }
    return {
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
      bank: {
        ...(scheme ? { scheme } : {}),
        bank_code: bank.bankCode.trim(),
        account_number: bank.accountNumber.trim(),
        bank_name: (args.bankName || "").trim(),
        account_holder_name: bank.accountHolderName.trim(),
        country: country || ben.country.trim().toUpperCase(),
      },
    };
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
