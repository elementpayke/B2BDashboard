import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  bulkPayoutDraftKey,
  clearBulkPayoutDraft,
  draftSummary,
  readBulkPayoutDraft,
  writeBulkPayoutDraft,
} from "@/lib/services/bulkPayoutDraft";

describe("bulkPayoutDraft", () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    vi.stubGlobal("sessionStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("requires a scope id", () => {
    expect(bulkPayoutDraftKey(null)).toBeNull();
    expect(bulkPayoutDraftKey("")).toBeNull();
    expect(bulkPayoutDraftKey(42)).toBe("ep.bulk-payout.draft.v1:42");
  });

  it("round-trips rows without inventing preview tokens", () => {
    const ok = writeBulkPayoutDraft(7, {
      sourceAccountId: "acc_1",
      csvText: "G...,2",
      rows: [{ destination: "GA", amount: "2", memo: "a", reference: "r1" }],
      stage: "edit",
    });
    expect(ok).toBe(true);
    const draft = readBulkPayoutDraft(7);
    expect(draft?.sourceAccountId).toBe("acc_1");
    expect(draft?.rows).toEqual([{ destination: "GA", amount: "2", memo: "a", reference: "r1" }]);
    expect(JSON.stringify(draft)).not.toMatch(/preview_token/);
    expect(draftSummary(draft!).total).toBe("2.00");
  });

  it("clears drafts", () => {
    writeBulkPayoutDraft(1, {
      sourceAccountId: "a",
      csvText: "",
      rows: [],
      stage: "input",
    });
    clearBulkPayoutDraft(1);
    expect(readBulkPayoutDraft(1)).toBeNull();
  });
});
