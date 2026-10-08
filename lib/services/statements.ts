import { apiDownloadBlob, apiEnvelope } from "@/lib/apiClient";

export type StatementAccount = {
  entity_id: string;
  account_id: string;
  name: string;
  currency: string;
  network?: string | null;
  asset_type?: string | null;
};

export type StatementPeriodRow = {
  period_key: string;
  period_label: string;
  year: number;
  month: number;
  entity_id: string;
  account_id: string;
  account_name: string;
  currency: string;
  network?: string | null;
  status: Array<"AVAILABLE" | "MTD">;
  line_count: number;
  total_deposits?: string | null;
  total_withdrawals?: string | null;
};

export type StatementList = {
  accounts: StatementAccount[];
  rows: StatementPeriodRow[];
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

function normalizeList(raw: unknown): StatementList {
  const obj = asRecord(raw) ?? {};
  const accountsRaw = Array.isArray(obj.accounts) ? obj.accounts : [];
  const rowsRaw = Array.isArray(obj.rows) ? obj.rows : [];
  return {
    accounts: accountsRaw
      .map(asRecord)
      .filter((row): row is Record<string, unknown> => row !== null)
      .map((row) => ({
        entity_id: asText(row.entity_id) || "",
        account_id: asText(row.account_id) || "",
        name: asText(row.name) || "Account",
        currency: (asText(row.currency) || "USDC").toUpperCase(),
        network: asText(row.network),
        asset_type: asText(row.asset_type),
      })),
    rows: rowsRaw
      .map(asRecord)
      .filter((row): row is Record<string, unknown> => row !== null)
      .map((row) => {
        const statusRaw = Array.isArray(row.status) ? row.status : [];
        const status = statusRaw
          .map((s) => String(s).toUpperCase())
          .filter((s): s is "AVAILABLE" | "MTD" => s === "AVAILABLE" || s === "MTD");
        return {
          period_key: asText(row.period_key) || "",
          period_label: asText(row.period_label) || "",
          year: Number(row.year) || 0,
          month: Number(row.month) || 0,
          entity_id: asText(row.entity_id) || "",
          account_id: asText(row.account_id) || "",
          account_name: asText(row.account_name) || "Account",
          currency: (asText(row.currency) || "USDC").toUpperCase(),
          network: asText(row.network),
          status,
          line_count: Number(row.line_count) || 0,
          total_deposits: asText(row.total_deposits),
          total_withdrawals: asText(row.total_withdrawals),
        };
      }),
  };
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export const statementsApi = {
  async list(): Promise<StatementList> {
    const raw = await apiEnvelope<unknown>("GET", "/v1/statements");
    return normalizeList(raw);
  },

  async download(opts: {
    entityId: string;
    accountId: string;
    periodKey: string;
    format: "pdf" | "csv";
  }): Promise<void> {
    const path =
      `/v1/statements/${encodeURIComponent(opts.entityId)}` +
      `/${encodeURIComponent(opts.accountId)}` +
      `/${encodeURIComponent(opts.periodKey)}` +
      `?format=${opts.format}`;
    const { blob, filename } = await apiDownloadBlob(path);
    const fallback = `statement-${opts.accountId}-${opts.periodKey}.${opts.format}`;
    triggerBlobDownload(blob, filename || fallback);
  },

  /** One file for an account across from→to (inclusive YYYY-MM). */
  async downloadRange(opts: {
    entityId: string;
    accountId: string;
    from: string;
    to: string;
    format: "pdf" | "csv";
  }): Promise<void> {
    const path =
      `/v1/statements/${encodeURIComponent(opts.entityId)}` +
      `/${encodeURIComponent(opts.accountId)}/export` +
      `?from=${encodeURIComponent(opts.from)}` +
      `&to=${encodeURIComponent(opts.to)}` +
      `&format=${opts.format}`;
    const { blob, filename } = await apiDownloadBlob(path);
    const fallback = `statement-${opts.accountId}-${opts.from}_${opts.to}.${opts.format}`;
    triggerBlobDownload(blob, filename || fallback);
  },
};
