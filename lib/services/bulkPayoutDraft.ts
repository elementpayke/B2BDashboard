/**
 * Tab-scoped bulk-payout draft (sessionStorage).
 * Never stores preview_token, secrets, or batch ids.
 * Requires a tenant scope id — skip persistence when missing (shared-device safety).
 */

import type { BulkStellarPayoutRow } from "@/lib/services/stellarDisbursements";

export type BulkPayoutDraftStage = "input" | "edit";

export type BulkPayoutDraft = {
  v: 1;
  sourceAccountId: string;
  csvText: string;
  rows: BulkStellarPayoutRow[];
  stage: BulkPayoutDraftStage;
  savedAt: string;
};

const PREFIX = "ep.bulk-payout.draft.v1:";

function storage(): Storage | null {
  if (typeof sessionStorage === "undefined") return null;
  return sessionStorage;
}

export function bulkPayoutDraftKey(scopeId: string | number | null | undefined): string | null {
  if (scopeId === null || scopeId === undefined) return null;
  const id = String(scopeId).trim();
  if (!id) return null;
  return `${PREFIX}${id}`;
}

export function readBulkPayoutDraft(
  scopeId: string | number | null | undefined,
): BulkPayoutDraft | null {
  const key = bulkPayoutDraftKey(scopeId);
  const store = storage();
  if (!key || !store) return null;
  try {
    const raw = store.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<BulkPayoutDraft>;
    if (parsed?.v !== 1 || !Array.isArray(parsed.rows)) return null;
    const stage = parsed.stage === "edit" ? "edit" : "input";
    return {
      v: 1,
      sourceAccountId: typeof parsed.sourceAccountId === "string" ? parsed.sourceAccountId : "",
      csvText: typeof parsed.csvText === "string" ? parsed.csvText : "",
      rows: parsed.rows.map((row) => ({
        destination: String(row?.destination ?? "").trim(),
        amount: String(row?.amount ?? "").trim(),
        memo: row?.memo != null ? String(row.memo) : "",
        reference: row?.reference != null ? String(row.reference) : "",
      })),
      stage,
      savedAt: typeof parsed.savedAt === "string" ? parsed.savedAt : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function writeBulkPayoutDraft(
  scopeId: string | number | null | undefined,
  draft: Omit<BulkPayoutDraft, "v" | "savedAt">,
): boolean {
  const key = bulkPayoutDraftKey(scopeId);
  const store = storage();
  if (!key || !store) return false;
  const payload: BulkPayoutDraft = {
    v: 1,
    sourceAccountId: draft.sourceAccountId,
    csvText: draft.csvText,
    rows: draft.rows.map((row) => ({
      destination: row.destination,
      amount: row.amount,
      memo: row.memo ?? "",
      reference: row.reference ?? "",
    })),
    stage: draft.stage === "edit" ? "edit" : "input",
    savedAt: new Date().toISOString(),
  };
  try {
    store.setItem(key, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

export function clearBulkPayoutDraft(scopeId: string | number | null | undefined): void {
  const key = bulkPayoutDraftKey(scopeId);
  const store = storage();
  if (!key || !store) return;
  try {
    store.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function draftSummary(draft: BulkPayoutDraft): { rows: number; total: string } {
  const rows = draft.rows.filter(
    (r) => r.destination.trim() || r.amount.trim() || r.memo?.trim() || r.reference?.trim(),
  );
  const total = rows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  return {
    rows: rows.length,
    total: total.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }),
  };
}
