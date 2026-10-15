import { readFileSync } from "fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearBulkPayoutDraft,
  readBulkPayoutDraft,
  writeBulkPayoutDraft,
} from "@/lib/services/bulkPayoutDraft";
import { parseBulkStellarPayoutCsv } from "@/lib/services/stellarDisbursements";

describe("bulk smoke 2+3+1 USDC", () => {
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

  it("parses three destinations totaling 6 USDC", () => {
    const text = readFileSync("docs/samples/sdp-bulk-payout-smoke-2-3-1.csv", "utf8");
    const rows = parseBulkStellarPayoutCsv(text);
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.amount)).toEqual(["2", "3", "1"]);
    expect(rows.reduce((s, r) => s + Number(r.amount), 0)).toBe(6);
  });

  it("drafts the smoke batch without preview_token", () => {
    const text = readFileSync("docs/samples/sdp-bulk-payout-smoke-2-3-1.csv", "utf8");
    const rows = parseBulkStellarPayoutCsv(text);
    writeBulkPayoutDraft(99, {
      sourceAccountId: "a",
      csvText: text,
      rows,
      stage: "edit",
    });
    const d = readBulkPayoutDraft(99);
    expect(d?.rows).toHaveLength(3);
    expect(JSON.stringify(d)).not.toMatch(/preview_token/);
    clearBulkPayoutDraft(99);
  });
});
