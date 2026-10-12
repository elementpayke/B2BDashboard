import { apiEnvelope } from "@/lib/apiClient";
import {
  offRampProvidersForRail,
  type CatalogProvider,
  type SupportedCatalogData,
} from "@/lib/services/catalog";
import { validateConvertAmount } from "@/lib/services/conversions";
import {
  mobileMoneyDisplayLabel,
  resolveMobileMoneyBrand,
} from "@/lib/services/mobileMoneyBrands";
import {
  explainDisbursementFailure,
  isTransientDisbursementError,
  newBulkPayoutIdempotencyKey,
  withTransientRetry,
} from "@/lib/services/stellarDisbursements";

export type PayoutRail = "stellar" | "mobile_money" | "bank";

/** Entry path chosen before upload — scopes sample CSV and edit columns. */
export type PayoutIntent = "wallets" | "wallets_and_phones";

export type MixedPayoutRow = {
  destination?: string | null;
  phone?: string | null;
  bank_account_number?: string | null;
  bank_code?: string | null;
  country?: string | null;
  /** Momo operator alias (mpesa, airtel, …) or catalog name/code — phone rows only. */
  network?: string | null;
  /** Resolved aggregator provider UUID after preview / catalog match. */
  network_id?: string | null;
  amount: string;
  currency: string;
  recipient_name?: string | null;
  memo?: string | null;
  reference?: string | null;
};

export type PayoutRailResolution = {
  rail: PayoutRail | null;
  error: string | null;
};

export type MixedPayoutPreviewItem = MixedPayoutRow & {
  row_index: number;
  rail: PayoutRail;
  recipient_label: string;
  status?: string | null;
  error?: string | null;
};

export type MixedPayoutPreview = {
  preview_token: string;
  total_items: number;
  stellar_item_count: number;
  fiat_item_count: number;
  items: MixedPayoutPreviewItem[];
};

export type MixedPayoutBatchItem = {
  id?: number;
  row_index: number;
  rail: PayoutRail;
  recipient_label: string;
  recipient_name?: string | null;
  amount: string;
  currency: string;
  status: string;
  tx_hash?: string | null;
  failure_code?: string | null;
  last_error?: string | null;
};

export type MixedPayoutBatch = {
  batch_id: string;
  status: string;
  total_items: number;
  stellar_item_count: number;
  fiat_item_count: number;
  total_value_usdc?: string | null;
  created_at?: string | null;
  finished_at?: string | null;
  items: MixedPayoutBatchItem[];
};

/** Legacy 10-column order (still accepted on paste/upload). */
const LEGACY_CSV_HEADERS = [
  "destination",
  "phone",
  "bank_account_number",
  "bank_code",
  "country",
  "amount",
  "currency",
  "recipient_name",
  "memo",
  "reference",
] as const;

const WALLETS_SAMPLE_HEADERS = [
  "destination",
  "amount",
  "currency",
  "recipient_name",
  "memo",
  "reference",
] as const;

const MIXED_SAMPLE_HEADERS = [
  "destination",
  "phone",
  "bank_account_number",
  "country",
  "network",
  "amount",
  "currency",
  "recipient_name",
  "memo",
  "reference",
] as const;

export const ONE_DESTINATION_PER_ROW =
  "Use one destination per row — wallet, phone, or bank account.";

export const PHONE_NETWORK_REQUIRED =
  "Phone payouts need a network (e.g. mpesa or airtel).";

export const BANK_NETWORK_REQUIRED =
  "Bank payouts need a network (bank name) or bank_code.";

/** First-batch OffRamp corridors featured in the mixed sample CSV. */
export const BULK_FIRST_BATCH_COUNTRIES = ["KE", "NG", "GH", "UG", "TZ"] as const;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asText(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const text = String(value).trim();
  return text || null;
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];
    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current.trim());
  return cells;
}

function isHeaderRow(cells: string[]): boolean {
  const normalized = cells.map((c) => c.trim().toLowerCase());
  return (
    normalized.includes("amount") &&
    (normalized.includes("destination") ||
      normalized.includes("phone") ||
      normalized.includes("bank_account_number"))
  );
}

function emptyMixedRow(): MixedPayoutRow {
  return {
    destination: null,
    phone: null,
    bank_account_number: null,
    bank_code: null,
    country: null,
    network: null,
    network_id: null,
    amount: "",
    currency: "USDC",
    recipient_name: null,
    memo: null,
    reference: null,
  };
}

function cellMapByHeaders(headers: string[], cells: string[]): MixedPayoutRow {
  const row = emptyMixedRow();
  const get = (name: string) => {
    const idx = headers.indexOf(name);
    if (idx < 0) return "";
    return (cells[idx] || "").trim();
  };
  row.destination = get("destination") || null;
  row.phone = get("phone") || null;
  row.bank_account_number = get("bank_account_number") || null;
  row.bank_code = get("bank_code") || null;
  row.country = get("country") || null;
  row.network = get("network") || get("provider") || null;
  row.amount = get("amount");
  row.currency = (get("currency") || "USDC").toUpperCase();
  row.recipient_name = get("recipient_name") || null;
  row.memo = get("memo") || null;
  row.reference = get("reference") || null;
  return row;
}

function cellMapLegacy(cells: string[]): MixedPayoutRow {
  return cellMapByHeaders([...LEGACY_CSV_HEADERS], cells);
}

/** Client-side mirror of Mboka `resolve_payout_rail` — UX only; server is authoritative. */
export function resolvePayoutRail(row: MixedPayoutRow): PayoutRailResolution {
  const hasDestination = Boolean((row.destination || "").trim());
  const hasPhone = Boolean((row.phone || "").trim());
  const hasBank =
    Boolean((row.bank_account_number || "").trim()) || Boolean((row.bank_code || "").trim());
  const groups = [hasDestination, hasPhone, hasBank].filter(Boolean).length;

  if (groups === 0) {
    return {
      rail: null,
      error: "Add a wallet address, phone number, or bank account for this person.",
    };
  }
  if (groups > 1) {
    return { rail: null, error: ONE_DESTINATION_PER_ROW };
  }
  if (hasDestination) return { rail: "stellar", error: null };
  if (hasPhone) {
    if (!(row.country || "").trim()) {
      return { rail: null, error: "Phone payouts need a country (e.g. KE)." };
    }
    if (!(row.recipient_name || "").trim()) {
      return { rail: null, error: "Phone payouts need the recipient’s name." };
    }
    if (!(row.network || "").trim() && !(row.network_id || "").trim()) {
      return { rail: null, error: PHONE_NETWORK_REQUIRED };
    }
    return { rail: "mobile_money", error: null };
  }
  if (!(row.bank_account_number || "").trim()) {
    return { rail: null, error: "Bank rows need bank_account_number." };
  }
  if (!(row.country || "").trim()) {
    return { rail: null, error: "Bank rows need country." };
  }
  if (!(row.recipient_name || "").trim()) {
    return { rail: null, error: "Bank rows need recipient_name." };
  }
  if (
    !(row.network || "").trim() &&
    !(row.bank_code || "").trim() &&
    !(row.network_id || "").trim()
  ) {
    return { rail: null, error: BANK_NETWORK_REQUIRED };
  }
  return { rail: "bank", error: null };
}

export function railLabel(rail: PayoutRail | null | undefined): string {
  if (rail === "stellar") return "Wallet";
  if (rail === "mobile_money") return "Mobile money";
  if (rail === "bank") return "Bank";
  return "Unresolved";
}

/** Method-column label: brand / bank name when network is known. */
export function payoutMethodLabel(
  rail: PayoutRail | null | undefined,
  network?: string | null,
): string {
  if (rail === "stellar") return "Wallet";
  if (rail === "bank") {
    const raw = (network || "").trim();
    return raw || "Bank";
  }
  if (rail === "mobile_money") {
    const raw = (network || "").trim();
    if (!raw) return "Mobile money";
    return mobileMoneyDisplayLabel(raw);
  }
  return "Unresolved";
}

function compactToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/[()]/g, " ")
    .replace(/\s+/g, "");
}

type OffRampRailType = "mobile" | "bank";

/** True when the CSV/UI network string is enough to send — server resolves UUID. */
export function hasResolvableNetworkAlias(
  rail: PayoutRail | null | undefined,
  row: Pick<MixedPayoutRow, "network" | "bank_code" | "network_id">,
): boolean {
  if ((row.network_id || "").trim()) return true;
  const alias = (row.network || row.bank_code || "").trim();
  if (!alias) return false;
  if (rail === "bank") return alias.length >= 2;
  if (rail === "mobile_money") {
    const brand = resolveMobileMoneyBrand(alias);
    if (brand && brand.key !== "generic") return true;
    // Allow catalog names / codes even when brand helper doesn't know them.
    return alias.length >= 2;
  }
  return false;
}

/**
 * Match a CSV/UI network alias to a catalog provider for the row country.
 * Returns null when no enabled provider matches (no silent first-provider pick).
 */
export function matchOffRampProviderForNetwork(
  catalog: SupportedCatalogData | null | undefined,
  country: string | null | undefined,
  network: string | null | undefined,
  railType: OffRampRailType,
  currency?: string | null,
): CatalogProvider | null {
  const needle = (network || "").trim();
  if (!needle || !country?.trim()) return null;
  const providers = offRampProvidersForRail(
    catalog,
    country.trim(),
    railType,
    currency || undefined,
  );
  if (!providers?.length) return null;

  const needleLower = needle.toLowerCase();
  const needleCompact = compactToken(needle);
  const exact = providers.find((p) => {
    const nameCompact = compactToken(p.name);
    const codeCompact = compactToken(p.code);
    return (
      p.name.trim().toLowerCase() === needleLower ||
      p.code.trim().toLowerCase() === needleLower ||
      (p.id || "").trim().toLowerCase() === needleLower ||
      nameCompact === needleCompact ||
      codeCompact === needleCompact ||
      (needleCompact.length >= 3 && nameCompact.includes(needleCompact)) ||
      (nameCompact.length >= 3 && needleCompact.includes(nameCompact))
    );
  });
  if (exact) return exact;

  if (railType !== "mobile") return null;
  const aliasBrand = resolveMobileMoneyBrand(needle);
  if (!aliasBrand || aliasBrand.key === "generic") return null;
  return (
    providers.find((p) => {
      const brand = resolveMobileMoneyBrand(p.name) || resolveMobileMoneyBrand(p.code);
      return brand?.key === aliasBrand.key;
    }) || null
  );
}

/** @deprecated Prefer matchOffRampProviderForNetwork(..., "mobile") */
export function matchMomoProviderForNetwork(
  catalog: SupportedCatalogData | null | undefined,
  country: string | null | undefined,
  network: string | null | undefined,
  currency?: string | null,
): CatalogProvider | null {
  return matchOffRampProviderForNetwork(catalog, country, network, "mobile", currency);
}

export function resolveRowNetworkId(
  catalog: SupportedCatalogData | null | undefined,
  row: MixedPayoutRow,
  rail?: PayoutRail | null,
): string | null {
  const resolvedRail = rail || resolvePayoutRail(row).rail;
  const railType: OffRampRailType | null =
    resolvedRail === "mobile_money" ? "mobile" : resolvedRail === "bank" ? "bank" : null;
  if (!railType) return null;

  const networkAlias = (row.network || row.bank_code || "").trim();
  const existing = (row.network_id || "").trim();
  if (existing) {
    const providers = offRampProvidersForRail(
      catalog,
      (row.country || "").trim(),
      railType,
      row.currency,
    );
    if (!providers?.length) return existing;
    const stillEnabled = providers.some((p) => (p.id || "").trim() === existing);
    return stillEnabled ? existing : null;
  }
  const match = matchOffRampProviderForNetwork(
    catalog,
    row.country,
    networkAlias,
    railType,
    row.currency,
  );
  return (match?.id || "").trim() || null;
}

export function parseMixedPayoutCsvLoose(csv: string): MixedPayoutRow[] {
  const lines = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) {
    throw new Error("Paste or upload at least one payout row.");
  }
  const rows = lines.map(splitCsvLine);
  if (isHeaderRow(rows[0])) {
    const headers = rows[0].map((c) => c.trim().toLowerCase());
    const dataRows = rows.slice(1);
    if (dataRows.length === 0) {
      throw new Error("Add at least one payout after the CSV header.");
    }
    return dataRows.map((cells) => cellMapByHeaders(headers, cells));
  }
  return rows.map(cellMapLegacy);
}

export function parseMixedPayoutCsv(csv: string): MixedPayoutRow[] {
  const rows = parseMixedPayoutCsvLoose(csv);
  return rows.map((row, index) => {
    const amount = validateConvertAmount(row.amount);
    const resolution = resolvePayoutRail({ ...row, amount });
    if (resolution.error || !resolution.rail) {
      throw new Error(`Row ${index + 1}: ${resolution.error || "unresolved payout."}`);
    }
    return { ...row, amount };
  });
}

export function samplePayoutCsv(intent: PayoutIntent): string {
  if (intent === "wallets") {
    return [
      WALLETS_SAMPLE_HEADERS.join(","),
      "GAIZK4AKUTPECFCZVLAZ47JDBMAGFXLTA465SWE7O3GXQOZ5C5O26YAW,5.00,USDC,Alex Guide,,EP-W-01",
      "GDQP2KPQGKIHYJGXNUIYOMHARUARCA7OJ2B5U77RWQWYSXA5NQNBZMSF,10.00,USDC,Sam Vendor,,EP-W-02",
    ].join("\n");
  }
  // First batch corridors: KE, NG, GH, UG, TZ — wallet + momo + bank examples.
  // Yellow Card sandbox magic numbers only (real MSISDNs can stick in pending):
  //   momo success  +{cc}1111111111   · momo fail  +{cc}0000000000
  //   bank success  1111111111        · bank fail  0000000000
  // See MBOKA_PARTNER_ORDER_INTEGRATION.md + YC sandbox-testing docs.
  return [
    MIXED_SAMPLE_HEADERS.join(","),
    "GAIZK4AKUTPECFCZVLAZ47JDBMAGFXLTA465SWE7O3GXQOZ5C5O26YAW,,,,,5.00,USDC,Alex Guide,,EP-M-01",
    ",+2541111111111,,KE,mpesa,1500,KES,Jane Mukami,,EP-M-02",
    ",,1111111111,KE,Equity Bank,2200,KES,Grace Otieno,,EP-M-03",
    ",+2341111111111,,NG,opay,50000,NGN,Chidi Okeke,,EP-M-04",
    ",+2331111111111,,GH,mtn,200,GHS,Ama Mensah,,EP-M-05",
    ",+2561111111111,,UG,mtn,100000,UGX,Peter Okello,,EP-M-06",
    ",+2551111111111,,TZ,mpesa,50000,TZS,Asha Juma,,EP-M-07",
    ",,1111111111,NG,GTBank,75000,NGN,Ngozi Adeyemi,,EP-M-08",
    ",+2540000000000,,KE,mpesa,100,KES,Sandbox Fail Momo,,EP-FAIL-MOMO",
    ",,0000000000,KE,Equity Bank,100,KES,Sandbox Fail Bank,,EP-FAIL-BANK",
  ].join("\n");
}

/** @deprecated Prefer samplePayoutCsv(intent) */
export function sampleMixedPayoutCsv(): string {
  return samplePayoutCsv("wallets_and_phones");
}

export function sampleCsvFilename(intent: PayoutIntent): string {
  return intent === "wallets" ? "pay-wallets-sample.csv" : "pay-wallets-and-phones-sample.csv";
}

/** Rail-aware wrapper around Stellar failure copy for fiat codes. */
export function explainPayoutFailure(
  code: string | null | undefined,
  rail?: PayoutRail | null,
): string | null {
  const key = (code || "").trim().toLowerCase();
  if (!key) return null;
  const fiatCopy: Record<string, string> = {
    quote_expired: "The payout quote expired before it could be accepted. Retry this row.",
    rate_limited: "The payout provider rate-limited this request. Wait a moment and retry.",
    upstream_error: "The payout provider had a temporary error. Retry this row.",
    quote_rejected: "The payout quote was rejected. Check the phone number and country.",
    validation_error: "This row failed validation. Fix the recipient details and retry.",
    bank_rail_not_yet_enabled:
      "Bank transfers aren’t available for this corridor yet — use a wallet or phone.",
    order_failed: "The payout failed after accept. Check the recipient details and balance.",
    fiat_item_failed: "This payout failed. Check the recipient details and try again.",
    insufficient_balance: "Your source wallet doesn’t have enough USDC for this payout.",
  };
  if (fiatCopy[key]) return fiatCopy[key];
  if (rail === "stellar" || !rail) {
    return explainDisbursementFailure(code);
  }
  const readable = key.replace(/_/g, " ");
  return `This payout failed (${readable}).`;
}

function normalizePreviewItem(raw: unknown, index: number): MixedPayoutPreviewItem {
  const row = asRecord(raw) ?? {};
  const rail = (asText(row.rail) || "stellar") as PayoutRail;
  return {
    row_index: typeof row.row_index === "number" ? row.row_index : index + 1,
    rail,
    recipient_label: asText(row.recipient_label) || "",
    recipient_name: asText(row.recipient_name),
    amount: asText(row.amount) || "",
    currency: asText(row.currency) || "USDC",
    status: asText(row.status),
    error: asText(row.error),
    destination: rail === "stellar" ? asText(row.recipient_label) : null,
    phone: rail === "mobile_money" ? asText(row.recipient_label) : null,
    bank_account_number: rail === "bank" ? asText(row.recipient_label) : null,
    network: asText(row.network),
    network_id: asText(row.network_id),
  };
}

export function normalizeMixedPreview(raw: unknown): MixedPayoutPreview {
  const obj = asRecord(raw) ?? {};
  const itemsRaw = Array.isArray(obj.items) ? obj.items : [];
  return {
    preview_token: asText(obj.preview_token) || "",
    total_items: typeof obj.total_items === "number" ? obj.total_items : itemsRaw.length,
    stellar_item_count: typeof obj.stellar_item_count === "number" ? obj.stellar_item_count : 0,
    fiat_item_count: typeof obj.fiat_item_count === "number" ? obj.fiat_item_count : 0,
    items: itemsRaw.map(normalizePreviewItem),
  };
}

export function normalizeMixedBatch(raw: unknown): MixedPayoutBatch {
  const obj = asRecord(raw) ?? {};
  const itemsRaw = Array.isArray(obj.items) ? obj.items : [];
  return {
    batch_id: asText(obj.id ?? obj.batch_id) || "",
    status: asText(obj.status) || "processing",
    total_items: typeof obj.total_items === "number" ? obj.total_items : itemsRaw.length,
    stellar_item_count: typeof obj.stellar_item_count === "number" ? obj.stellar_item_count : 0,
    fiat_item_count: typeof obj.fiat_item_count === "number" ? obj.fiat_item_count : 0,
    total_value_usdc: asText(obj.total_value_usdc),
    created_at: asText(obj.created_at),
    finished_at: asText(obj.finished_at),
    items: itemsRaw.map((rawItem, index) => {
      const row = asRecord(rawItem) ?? {};
      return {
        id: typeof row.id === "number" ? row.id : undefined,
        row_index: typeof row.row_index === "number" ? row.row_index : index + 1,
        rail: (asText(row.rail) || "stellar") as PayoutRail,
        recipient_label: asText(row.recipient_label) || "",
        recipient_name: asText(row.recipient_name),
        amount: asText(row.amount) || "",
        currency: asText(row.currency) || "USDC",
        status: asText(row.status) || "pending",
        tx_hash: asText(row.tx_hash),
        failure_code: asText(row.failure_code),
        last_error: asText(row.last_error),
      };
    }),
  };
}

export function normalizeMixedBatchList(raw: unknown): MixedPayoutBatch[] {
  const obj = asRecord(raw) ?? {};
  const list = Array.isArray(obj.batches) ? obj.batches : [];
  return list.map(normalizeMixedBatch);
}

export { newBulkPayoutIdempotencyKey, isTransientDisbursementError, withTransientRetry };

export const MIXED_PAYOUT_CSV_HEADERS = MIXED_SAMPLE_HEADERS;

/** Normalize rows for Mboka preview (legacy bank_code + network aliases). */
export function preparePayoutRowsForPreview(rows: MixedPayoutRow[]): MixedPayoutRow[] {
  return rows.map((row) => {
    const next = { ...row };
    const network = (next.network || next.bank_code || "").trim() || null;
    if (network) next.network = network;
    // Dual-write so older APIs that still require bank_code accept bank rows.
    if ((next.bank_account_number || "").trim() && !(next.bank_code || "").trim() && network) {
      next.bank_code = network;
    }
    return next;
  });
}

export const payoutBatchesApi = {
  async preview(
    entity_id: string,
    account_id: string,
    rows: MixedPayoutRow[],
    opts?: { idempotencyKey?: string },
  ) {
    const body: Record<string, unknown> = {
      entity_id,
      account_id,
      rows: preparePayoutRowsForPreview(rows),
    };
    const key = (opts?.idempotencyKey || "").trim();
    if (key) body.idempotency_key = key.slice(0, 64);
    const raw = await apiEnvelope<unknown>("POST", "/v1/payouts/batches/preview", body);
    return normalizeMixedPreview(raw);
  },

  async confirm(entity_id: string, account_id: string, preview_token: string) {
    const raw = await apiEnvelope<unknown>("POST", "/v1/payouts/batches/confirm", {
      entity_id,
      account_id,
      preview_token,
    });
    return normalizeMixedBatch(raw);
  },

  async getBatch(entity_id: string, account_id: string, batch_id: string) {
    const raw = await apiEnvelope<unknown>(
      "GET",
      `/v1/entities/${encodeURIComponent(entity_id)}/accounts/${encodeURIComponent(account_id)}/payout-batches/${encodeURIComponent(batch_id)}`,
    );
    return normalizeMixedBatch(raw);
  },

  async listBatches(entity_id: string, account_id: string, limit = 50) {
    const raw = await apiEnvelope<unknown>(
      "GET",
      `/v1/entities/${encodeURIComponent(entity_id)}/accounts/${encodeURIComponent(account_id)}/payout-batches?limit=${encodeURIComponent(String(limit))}`,
    );
    return normalizeMixedBatchList(raw);
  },

  async syncBatch(entity_id: string, account_id: string, batch_id: string) {
    const raw = await apiEnvelope<unknown>(
      "POST",
      `/v1/entities/${encodeURIComponent(entity_id)}/accounts/${encodeURIComponent(account_id)}/payout-batches/${encodeURIComponent(batch_id)}/sync`,
    );
    return normalizeMixedBatch(raw);
  },
};
