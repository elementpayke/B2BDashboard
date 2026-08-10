/**
 * Saved recipients (beneficiaries) — dashboard-owned address book.
 *
 * Shared types + validation for the Send money "select from saved details"
 * flow. Persistence: `lib/server/savedRecipientsStore.ts`. HTTP:
 * `app/api/saved-recipients/`. Client: `lib/clients/savedRecipientsApi.ts`.
 * See `docs/saved-recipients.md`.
 */

export type RailType = "bank" | "mobile" | "crypto";

export const RAIL_TYPES: readonly RailType[] = ["bank", "mobile", "crypto"] as const;

export type SavedRecipient = {
  id: string;
  businessId: number;
  /** Display name / nickname (maps from send form recipient name). */
  label: string;
  /** Bank account, MoMo phone, or crypto wallet address. */
  accountNumber: string;
  railType: RailType;
  countryCode?: string | null;
  currency?: string | null;
  /** Momo/bank provider id or label from the catalog/send form. */
  provider?: string | null;
  /** Crypto rail only — e.g. Base, Polygon. */
  network?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SavedRecipientCreate = {
  label: string;
  accountNumber: string;
  railType: RailType;
  countryCode?: string | null;
  currency?: string | null;
  provider?: string | null;
  network?: string | null;
};

export type SavedRecipientList = {
  items: SavedRecipient[];
  total: number;
};

/** Fields the Send form needs when the user picks a saved row. */
export type SendFormRecipientFields = {
  recipientName: string;
  recipient: string;
  railType: RailType;
  countryCode: string | null;
  currency: string | null;
  provider: string | null;
  network: string | null;
};

export const SAVED_RECIPIENT_LIMITS = {
  maxPerBusiness: 100,
  labelMax: 120,
  accountNumberMax: 256,
  optionalMax: 64,
} as const;

export type SavedRecipientValidationError = {
  ok: false;
  message: string;
  field?: string;
};

export type SavedRecipientValidationOk = {
  ok: true;
  value: SavedRecipientCreate;
};

export type SavedRecipientValidationResult =
  | SavedRecipientValidationOk
  | SavedRecipientValidationError;

export function isRailType(value: unknown): value is RailType {
  return typeof value === "string" && (RAIL_TYPES as readonly string[]).includes(value);
}

function trimToNull(value: unknown, max: number): string | null | { error: string } {
  if (value == null) return null;
  if (typeof value !== "string") return { error: "must be a string" };
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > max) return { error: `must be ≤ ${max} characters` };
  return trimmed;
}

/**
 * Pure validation + normalisation for POST /api/saved-recipients bodies.
 * Safe to call from route handlers and unit tests.
 */
export function parseCreateSavedRecipientInput(
  body: unknown,
): SavedRecipientValidationResult {
  if (body == null || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, message: "Request body must be a JSON object" };
  }

  const raw = body as Record<string, unknown>;

  // Accept UI aliases: name→label, account→accountNumber, rail→railType.
  const labelRaw = raw.label ?? raw.name;
  if (typeof labelRaw !== "string") {
    return { ok: false, message: "label is required", field: "label" };
  }
  const label = labelRaw.trim();
  if (!label) {
    return { ok: false, message: "label is required", field: "label" };
  }
  if (label.length > SAVED_RECIPIENT_LIMITS.labelMax) {
    return {
      ok: false,
      message: `label must be ≤ ${SAVED_RECIPIENT_LIMITS.labelMax} characters`,
      field: "label",
    };
  }

  const accountRaw = raw.accountNumber ?? raw.account;
  if (typeof accountRaw !== "string") {
    return { ok: false, message: "accountNumber is required", field: "accountNumber" };
  }
  const accountNumber = accountRaw.trim();
  if (!accountNumber) {
    return { ok: false, message: "accountNumber is required", field: "accountNumber" };
  }
  if (accountNumber.length > SAVED_RECIPIENT_LIMITS.accountNumberMax) {
    return {
      ok: false,
      message: `accountNumber must be ≤ ${SAVED_RECIPIENT_LIMITS.accountNumberMax} characters`,
      field: "accountNumber",
    };
  }

  const railRaw = raw.railType ?? raw.rail;
  if (!isRailType(railRaw)) {
    return {
      ok: false,
      message: `railType must be one of: ${RAIL_TYPES.join(", ")}`,
      field: "railType",
    };
  }

  const countryCodeRaw = trimToNull(raw.countryCode, SAVED_RECIPIENT_LIMITS.optionalMax);
  if (typeof countryCodeRaw === "object" && countryCodeRaw !== null) {
    return { ok: false, message: `countryCode ${countryCodeRaw.error}`, field: "countryCode" };
  }

  const currencyRaw = trimToNull(raw.currency, SAVED_RECIPIENT_LIMITS.optionalMax);
  if (typeof currencyRaw === "object" && currencyRaw !== null) {
    return { ok: false, message: `currency ${currencyRaw.error}`, field: "currency" };
  }

  const providerRaw = trimToNull(raw.provider, SAVED_RECIPIENT_LIMITS.optionalMax);
  if (typeof providerRaw === "object" && providerRaw !== null) {
    return { ok: false, message: `provider ${providerRaw.error}`, field: "provider" };
  }

  const networkRaw = trimToNull(raw.network, SAVED_RECIPIENT_LIMITS.optionalMax);
  if (typeof networkRaw === "object" && networkRaw !== null) {
    return { ok: false, message: `network ${networkRaw.error}`, field: "network" };
  }

  const countryCode = countryCodeRaw as string | null;
  const currency = currencyRaw as string | null;
  const provider = providerRaw as string | null;
  const network = networkRaw as string | null;
  const railType: RailType = railRaw;

  if (railType === "crypto" && !network) {
    return {
      ok: false,
      message: "network is required when railType is crypto",
      field: "network",
    };
  }

  return {
    ok: true,
    value: {
      label,
      accountNumber,
      railType,
      countryCode: countryCode ? countryCode.toUpperCase() : null,
      currency: currency ? currency.toUpperCase() : null,
      provider,
      network,
    },
  };
}

/** Map a saved row onto the Send modal form field names. */
export function toSendFormFields(recipient: SavedRecipient): SendFormRecipientFields {
  return {
    recipientName: recipient.label,
    recipient: recipient.accountNumber,
    railType: recipient.railType,
    countryCode: recipient.countryCode ?? null,
    currency: recipient.currency ?? null,
    provider: recipient.provider ?? null,
    network: recipient.network ?? null,
  };
}

/** Short one-line summary for picker rows (e.g. "Jane · M-Pesa · •••5678"). */
export function formatSavedRecipientSummary(recipient: SavedRecipient): string {
  const via =
    recipient.railType === "crypto"
      ? recipient.network ?? "crypto"
      : recipient.provider ?? recipient.railType;
  const acct = recipient.accountNumber.trim();
  const masked =
    acct.length <= 4 ? acct : `•••${acct.slice(-4)}`;
  return `${recipient.label} · ${via} · ${masked}`;
}
