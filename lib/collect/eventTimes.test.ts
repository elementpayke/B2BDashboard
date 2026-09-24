import { describe, expect, it } from "vitest";
import { applyCollectEventTimes, collectEventTimesFromPayload } from "./eventTimes";

describe("collectEventTimesFromPayload", () => {
  it("reads the worker created_at for each source transaction", () => {
    expect(
      collectEventTimesFromPayload({
        transfers: [
          {
            source_tx_hash: "0xABC",
            created_at: "2026-09-22T20:07:09",
          },
        ],
      }),
    ).toEqual([{ sourceTxHash: "0xabc", createdAt: "2026-09-22T20:07:09" }]);
  });
});

describe("applyCollectEventTimes", () => {
  const transfers = [
    { sourceTxHash: "0xnew", createdAt: "2026-09-23T07:01:14" },
    { sourceTxHash: "0xold", createdAt: "2026-09-22T17:50:10" },
  ];

  it("replaces the sync clock on matching Collect rows only", () => {
    const rows = applyCollectEventTimes(
      [
        {
          id: "cctp_1",
          source: "cctp_transfer",
          source_tx_hash: "0xOLD",
          created_at: "2026-09-23T07:19:00",
        },
        {
          id: "onchain",
          source: "stellar_payment",
          source_tx_hash: "abc",
          created_at: "2026-08-28T13:40:00Z",
        },
      ],
      transfers,
    );

    expect(rows[0]?.created_at).toBe("2026-09-22T17:50:10");
    expect(rows[1]?.created_at).toBe("2026-08-28T13:40:00Z");
  });
});
