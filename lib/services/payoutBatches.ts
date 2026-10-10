import { apiEnvelope } from "@/lib/apiClient";
import { validateConvertAmount } from "@/lib/services/conversions";
import {
  explainDisbursementFailure,
  isTransientDisbursementError,
  newBulkPayoutIdempotencyKey,
  withTransientRetry,
} from "@/lib/services/stellarDisbursements";

export type PayoutRail = "stellar" | "mobile_money" | "bank";

export type MixedPayoutRow = {
  destination?: string | null;
  phone?: string | null;
  bank_account_number?: string | null;
  bank_code?: string | null;
  country?: string | null;
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

const CSV_HEADERS = [
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
    normalized.includes("destination") &&
    normalized.includes("phone") &&
    normalized.includes("amount")
  );
}

function cellMap(cells: string[]): MixedPayoutRow {
  return {
    destination: (cells[0] || "").trim() || null,
    phone: (cells[1] || "").trim() || null,
    bank_account_number: (cells[2] || "").trim() || null,
    bank_code: (cells[3] || "").trim() || null,
    country: (cells[4] || "").trim() || null,
    amount: (cells[5] || "").trim(),
    currency: ((cells[6] || "").trim() || "USDC").toUpperCase(),
    recipient_name: (cells[7] || "").trim() || null,
    memo: (cells[8] || "").trim() || null,
    reference: (cells[9] || "").trim() || null,
  };
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
      error: "Fill destination, phone, or bank_account_number + bank_code.",
    };
  }
  if (groups > 1) {
    return {
      rail: null,
      error:
        "Fill exactly one of destination, phone, or bank_account_number + bank_code — not more than one.",
    };
  }
  if (hasDestination) return { rail: "stellar", error: null };
  if (hasPhone) {
    if (!(row.country || "").trim()) {
      return { rail: null, error: "phone rows need country." };
    }
    if (!(row.recipient_name || "").trim()) {
      return { rail: null, error: "phone rows need recipient_name." };
    }
    return { rail: "mobile_money", error: null };
  }
  if (!(row.bank_account_number || "").trim()) {
    return { rail: null, error: "bank rows need bank_account_number." };
  }
  if (!(row.bank_code || "").trim()) {
    return { rail: null, error: "bank rows need bank_code." };
  }
  if (!(row.country || "").trim()) {
    return { rail: null, error: "bank rows need country." };
  }
  if (!(row.recipient_name || "").trim()) {
    return { rail: null, error: "bank rows need recipient_name." };
  }
  return { rail: "bank", error: null };
}

export function railLabel(rail: PayoutRail | null | undefined): string {
  if (rail === "stellar") return "Stellar";
  if (rail === "mobile_money") return "Mobile money";
  if (rail === "bank") return "Bank";
  return "Unresolved";
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
  const dataRows = isHeaderRow(rows[0]) ? rows.slice(1) : rows;
  if (dataRows.length === 0) {
    throw new Error("Add at least one payout after the CSV header.");
  }
  return dataRows.map(cellMap);
}

export function parseMixedPayoutCsv(csv: string): MixedPayoutRow[] {
  const rows = parseMixedPayoutCsvLoose(csv);
  return rows.map((row, index) => {
    const amount = validateConvertAmount(row.amount);
    const resolution = resolvePayoutRail({ ...row, amount });
    if (resolution.error || !resolution.rail) {
      throw new Error(`Row ${index + 1}: ${resolution.error || "unresolved rail."}`);
    }
    if (resolution.rail === "bank") {
      throw new Error(
        `Row ${index + 1}: bank transfers aren't supported in bulk payouts yet — use a wallet or phone.`,
      );
    }
    return { ...row, amount };
  });
}

export function sampleMixedPayoutCsv(): string {
  return [
    CSV_HEADERS.join(","),
    "GAIZK4AKUTPECFCZVLAZ47JDBMAGFXLTA465SWE7O3GXQOZ5C5O26YAW,,,,,5.00,USDC,,,EP-MIX-01",
    ",+254711111111,,,KE,1500,KES,Jane Mukami,,EP-MIX-02",
  ].join("\n");
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
      "Bank transfers aren’t available in bulk payouts yet — use a Stellar wallet or phone number.",
    order_failed: "The mobile-money payout failed after accept. Check the phone number and balance.",
    fiat_item_failed: "This mobile-money payout failed. Check the recipient details and try again.",
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

export const MIXED_PAYOUT_CSV_HEADERS = CSV_HEADERS;

export const payoutBatchesApi = {
  async preview(
    entity_id: string,
    account_id: string,
    rows: MixedPayoutRow[],
    opts?: { idempotencyKey?: string },
  ) {
    const body: Record<string, unknown> = { entity_id, account_id, rows };
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
