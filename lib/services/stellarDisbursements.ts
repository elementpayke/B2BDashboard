import { apiEnvelope } from "@/lib/apiClient";
import { validateConvertAmount } from "@/lib/services/conversions";

export type BulkStellarPayoutRow = {
  destination: string;
  amount: string;
  memo?: string | null;
  reference?: string | null;
};

export type BulkStellarPayoutPreview = {
  preview_token: string;
  total_amount: string | null;
  currency: string;
  items: Array<BulkStellarPayoutRow & { status?: string | null }>;
};

export type BulkStellarPayoutBatch = {
  batch_id: string;
  status: string;
  items: Array<BulkStellarPayoutRow & { status?: string | null; error?: string | null }>;
};

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
  const first = (cells[0] || "").trim().toLowerCase();
  const second = (cells[1] || "").trim().toLowerCase();
  return ["destination", "address", "wallet", "wallet_address"].includes(first) && second === "amount";
}

export function parseBulkStellarPayoutCsv(csv: string): BulkStellarPayoutRow[] {
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

  return dataRows.map((cells, index) => {
    const destination = (cells[0] || "").trim();
    const amount = validateConvertAmount((cells[1] || "").trim());
    if (!destination) {
      throw new Error(`Row ${index + 1} is missing a destination address.`);
    }
    return {
      destination,
      amount,
      memo: (cells[2] || "").trim() || null,
      reference: (cells[3] || "").trim() || null,
    };
  });
}

function normalizeItems(raw: unknown): BulkStellarPayoutBatch["items"] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(asRecord)
    .filter((row): row is Record<string, unknown> => row !== null)
    .map((row) => ({
      destination:
        asText(row.destination ?? row.to_address ?? row.wallet_address) || "",
      amount: asText(row.amount) || "",
      memo: asText(row.memo),
      reference: asText(row.reference ?? row.client_reference),
      status: asText(row.status),
      error: asText(row.error ?? row.message),
    }));
}

export function normalizeBulkPreview(raw: unknown): BulkStellarPayoutPreview {
  const obj = asRecord(raw) ?? {};
  return {
    preview_token: asText(obj.preview_token ?? obj.quote_id) || "",
    total_amount: asText(obj.total_amount ?? obj.amount),
    currency: asText(obj.currency) || "USDC",
    items: normalizeItems(obj.items ?? obj.rows).map((item) => ({
      destination: item.destination,
      amount: item.amount,
      memo: item.memo,
      reference: item.reference,
      status: item.status,
    })),
  };
}

export function normalizeBulkBatch(raw: unknown): BulkStellarPayoutBatch {
  const obj = asRecord(raw) ?? {};
  return {
    batch_id: asText(obj.batch_id ?? obj.id) || "",
    status: asText(obj.status) || "submitted",
    items: normalizeItems(obj.items ?? obj.rows),
  };
}

export const stellarDisbursementsApi = {
  // entity_id/account_id (not just the account) are required so the backend
  // can verify ownership via owned_stellar_account_context — same body shape
  // as the Stellar swap quote/confirm pair (/v1/conversions/stellar/*).
  async preview(entity_id: string, account_id: string, items: BulkStellarPayoutRow[]) {
    const raw = await apiEnvelope<unknown>(
      "POST",
      "/v1/disbursements/stellar/preview",
      { entity_id, account_id, items },
    );
    return normalizeBulkPreview(raw);
  },

  async confirm(entity_id: string, account_id: string, preview_token: string) {
    const raw = await apiEnvelope<unknown>(
      "POST",
      "/v1/disbursements/stellar/confirm",
      { entity_id, account_id, preview_token },
    );
    return normalizeBulkBatch(raw);
  },
};
