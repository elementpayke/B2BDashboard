import { apiEnvelope, ApiRequestError } from "@/lib/apiClient";
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
  items: Array<
    BulkStellarPayoutRow & {
      status?: string | null;
      error?: string | null;
      /** Stellar payment hash when submitted on-chain. */
      tx_hash?: string | null;
    }
  >;
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

// Same shape as parseBulkStellarPayoutCsv, but never throws on a single bad
// row (missing destination, unparseable/too-small amount) — it returns every
// row, valid or not, so the editable-rows table can show and let the user
// fix exactly what's wrong instead of rejecting the whole paste/upload.
// Only throws when there's nothing at all to edit (empty input, or a header
// with no data rows under it). Row-level validation happens at preview time.
export function parseBulkStellarPayoutCsvLoose(csv: string): BulkStellarPayoutRow[] {
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

  return dataRows.map((cells) => ({
    destination: (cells[0] || "").trim(),
    amount: (cells[1] || "").trim(),
    memo: (cells[2] || "").trim() || null,
    reference: (cells[3] || "").trim() || null,
  }));
}

/** Map Aggregator / Mboka machine codes to plain-language copy for merchants. */
export function explainDisbursementFailure(code: string | null | undefined): string | null {
  const key = (code || "").trim().toLowerCase();
  if (!key) return null;
  const copy: Record<string, string> = {
    destination_missing_trustline:
      "This wallet hasn’t added a USDC trustline yet. Ask the recipient to trust Circle USDC on Stellar, then retry.",
    destination_account_not_found:
      "This Stellar address isn’t active on the network yet. The recipient needs to create/fund the account first.",
    insufficient_balance:
      "Your source wallet doesn’t have enough USDC (plus fees) for this payout.",
    funding_account_unusable:
      "We couldn’t sign from your Stellar wallet. Refresh and try again, or contact support if it persists.",
    stellar_submit_failed:
      "Stellar rejected this payment. Check the destination and try again.",
    stellar_submit_unconfirmed:
      "Payment was broadcast but not confirmed yet. Refresh batch status in a moment.",
    sdp_adapter_unavailable:
      "Payouts are in dry-run mode here — nothing was sent on-chain.",
    stellar_disbursement_submit_failed:
      "We couldn’t submit this batch. Try again or contact support.",
  };
  if (copy[key]) return copy[key];
  // Unknown codes: surface a readable sentence, not a bare snake_case token.
  const readable = key.replace(/_/g, " ");
  return `This payout failed (${readable}).`;
}

function normalizeItems(raw: unknown): BulkStellarPayoutBatch["items"] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(asRecord)
    .filter((row): row is Record<string, unknown> => row !== null)
    .map((row) => ({
      destination:
        asText(
          row.destination ??
            row.destination_address ??
            row.to_address ??
            row.wallet_address,
        ) || "",
      amount: asText(row.amount) || "",
      memo: asText(row.memo),
      reference: asText(row.reference ?? row.client_reference ?? row.partner_item_ref),
      status: asText(row.status),
      error: asText(
        row.error ?? row.failure_code ?? row.failureCode ?? row.last_error ?? row.message,
      ),
      tx_hash: asText(
        row.tx_hash ??
          row.txHash ??
          row.transaction_hash ??
          row.transactionHash ??
          row.external_item_id ??
          row.externalItemId,
      ),
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

/** Stable key for one preview→confirm attempt. Reuse on confirm retries only. */
export function newBulkPayoutIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `bulk-${crypto.randomUUID()}`;
  }
  return `bulk-${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

/** Proxy/Mboka/Aggregator blips that are safe to retry once (with idempotency). */
export function isTransientDisbursementError(err: unknown): boolean {
  if (err instanceof ApiRequestError) {
    return err.status === 408 || err.status === 502 || err.status === 503 || err.status === 504;
  }
  const message = err instanceof Error ? err.message : String(err ?? "");
  return /timed out|timeout|upstream|502|503|504/i.test(message);
}

/** One silent retry on transient errors; non-transient failures throw immediately. */
export async function withTransientRetry<T>(
  fn: () => Promise<T>,
  opts?: { retries?: number; delayMs?: number },
): Promise<T> {
  const retries = opts?.retries ?? 1;
  const delayMs = opts?.delayMs ?? 900;
  let last: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      last = err;
      if (attempt >= retries || !isTransientDisbursementError(err)) throw err;
      await new Promise((resolve) => setTimeout(resolve, delayMs * (attempt + 1)));
    }
  }
  throw last;
}

export const stellarDisbursementsApi = {
  // entity_id/account_id (not just the account) are required so the backend
  // can verify ownership via owned_stellar_account_context — same body shape
  // as the Stellar swap quote/confirm pair (/v1/conversions/stellar/*).
  async preview(
    entity_id: string,
    account_id: string,
    items: BulkStellarPayoutRow[],
    opts?: { idempotencyKey?: string },
  ) {
    const body: Record<string, unknown> = { entity_id, account_id, items };
    const key = (opts?.idempotencyKey || "").trim();
    if (key) body.idempotency_key = key.slice(0, 64);
    const raw = await apiEnvelope<unknown>("POST", "/v1/disbursements/stellar/preview", body);
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

  async getBatch(entity_id: string, account_id: string, batch_id: string) {
    const raw = await apiEnvelope<unknown>(
      "GET",
      `/v1/entities/${encodeURIComponent(entity_id)}/accounts/${encodeURIComponent(account_id)}/disbursements/${encodeURIComponent(batch_id)}`,
    );
    return normalizeBulkBatch(raw);
  },
};
