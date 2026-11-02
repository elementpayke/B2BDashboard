import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/apiClient", () => ({
  apiEnvelope: vi.fn(),
}));

import { apiEnvelope } from "@/lib/apiClient";
import { liquidityApi, normalizeStellarLiquidity } from "./liquidity";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("normalizeStellarLiquidity", () => {
  it("normalizes aggregator snapshot rows with depth mid", () => {
    expect(
      normalizeStellarLiquidity({
        snapshots: [
          {
            pair: "EURC/USDC",
            venue: "aquarius_amm",
            captured_at: "2026-10-08T12:00:00Z",
            depth: { mid: "1.001", best_bid: "1.001", best_ask: "1.001" },
          },
        ],
      }),
    ).toEqual({
      refreshed_at: "2026-10-08T12:00:00Z",
      pairs: [
        {
          id: "EURC/USDC",
          base: "EURC",
          quote: "USDC",
          pair: "EURC/USDC",
          bid: "1.001",
          ask: "1.001",
        },
      ],
    });
  });

  it("normalizes pair rows from envelope-style payloads", () => {
    expect(
      normalizeStellarLiquidity({
        refreshed_at: "2026-09-17T18:15:00Z",
        pairs: [
          { pair: "USDT/USDC", best_bid: "0.9996", best_ask: "1.0008" },
          { base_asset: "EURC", quote_asset: "USDC", bid: "1.084", ask: "1.087" },
        ],
      }),
    ).toEqual({
      refreshed_at: "2026-09-17T18:15:00Z",
      pairs: [
        {
          id: "USDT/USDC",
          base: "USDT",
          quote: "USDC",
          pair: "USDT/USDC",
          bid: "0.9996",
          ask: "1.0008",
        },
        {
          id: "EURC-USDC-1",
          base: "EURC",
          quote: "USDC",
          pair: "EURC/USDC",
          bid: "1.084",
          ask: "1.087",
        },
      ],
    });
  });
});

describe("liquidityApi.stellar", () => {
  it("parses the Mboka liquidity response", async () => {
    vi.mocked(apiEnvelope).mockResolvedValue({
      refreshedAt: "2026-09-17T18:22:00Z",
      items: [{ symbol: "USDT/USDC", buy: "0.9997", sell: "1.0004" }],
    } as never);

    await expect(liquidityApi.stellar()).resolves.toEqual({
      refreshed_at: "2026-09-17T18:22:00Z",
      pairs: [
        {
          id: "USDT/USDC",
          base: "USDT",
          quote: "USDC",
          pair: "USDT/USDC",
          bid: "0.9997",
          ask: "1.0004",
        },
      ],
    });
  });
});
