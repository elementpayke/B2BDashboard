import { describe, expect, it } from "vitest";
import { normalizeAccountActivityPage } from "./accountActivity";

describe("normalizeAccountActivityPage", () => {
  it("normalizes a well-formed backend page", () => {
    const page = normalizeAccountActivityPage(
      {
        entries: [
          { event_type: "account_opened", label: "Account opened", occurred_at: "2026-09-01T10:00:00Z" },
          {
            event_type: "bank_details_issued",
            label: "Bank details issued",
            occurred_at: "2026-09-01T10:05:00Z",
            detail: "USD account",
          },
        ],
        total: 2,
      },
      { limit: 20, offset: 0 },
    );
    expect(page).toEqual({
      entries: [
        { event_type: "account_opened", label: "Account opened", occurred_at: "2026-09-01T10:00:00Z", detail: null },
        {
          event_type: "bank_details_issued",
          label: "Bank details issued",
          occurred_at: "2026-09-01T10:05:00Z",
          detail: "USD account",
        },
      ],
      total: 2,
      limit: 20,
      offset: 0,
    });
  });

  it("drops malformed entries instead of crashing or inventing fields", () => {
    const page = normalizeAccountActivityPage(
      {
        entries: [
          { event_type: "account_opened", label: "Account opened", occurred_at: "2026-09-01T10:00:00Z" },
          { event_type: "", label: "Missing event type", occurred_at: "2026-09-01T10:00:00Z" },
          { event_type: "no_label", occurred_at: "2026-09-01T10:00:00Z" },
          { event_type: "no_timestamp", label: "Missing timestamp" },
          "not an object",
          null,
        ],
        total: 6,
      },
      { limit: 20, offset: 0 },
    );
    expect(page.entries).toEqual([
      { event_type: "account_opened", label: "Account opened", occurred_at: "2026-09-01T10:00:00Z", detail: null },
    ]);
  });

  it("falls back to the surviving entry count when total is missing or malformed", () => {
    const page = normalizeAccountActivityPage(
      {
        entries: [
          { event_type: "account_opened", label: "Account opened", occurred_at: "2026-09-01T10:00:00Z" },
        ],
      },
      { limit: 20, offset: 0 },
    );
    expect(page.total).toBe(1);
  });

  it("degrades to an empty page for a missing or malformed response rather than throwing", () => {
    expect(normalizeAccountActivityPage(null, { limit: 20, offset: 0 })).toEqual({
      entries: [],
      total: 0,
      limit: 20,
      offset: 0,
    });
    expect(normalizeAccountActivityPage({ entries: "nope" }, { limit: 20, offset: 0 })).toEqual({
      entries: [],
      total: 0,
      limit: 20,
      offset: 0,
    });
  });
});
