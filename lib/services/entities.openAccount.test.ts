import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  buildStablecoinOpenPayload,
  describeStablecoinAccountStatus,
  isClosedStatus,
  isCloseableStablecoinAccount,
  isListedStablecoinAccount,
  isSendableStablecoinAccount,
  occupiedStablecoinNetworkCodes,
  normalizeFinancialAccount,
  resolvePrimaryEntityId,
  toPartnerNetwork,
  entitiesApi,
} from "./entities";

describe("buildStablecoinOpenPayload", () => {
  it("maps UI network codes to partner network names", () => {
    expect(
      buildStablecoinOpenPayload({
        currency: "usdc",
        network: "BASE",
        displayName: "Treasury USDC",
      }),
    ).toEqual({
      asset_type: "stablecoin",
      currency: "USDC",
      network: "Base",
      display_name: "Treasury USDC",
    });
    expect(toPartnerNetwork("polygon")).toBe("Polygon");
    expect(toPartnerNetwork("stellar")).toBe("Stellar");
  });

  it("rejects unsupported asset / network", () => {
    expect(() =>
      buildStablecoinOpenPayload({
        currency: "DAI",
        network: "BASE",
        displayName: "x",
      }),
    ).toThrow(/USDC or USDT/);
    expect(() =>
      buildStablecoinOpenPayload({
        currency: "USDT",
        network: "STELLAR",
        displayName: "x",
      }),
    ).toThrow(/USDT is not available on Stellar/);
    expect(() =>
      buildStablecoinOpenPayload({
        currency: "USDC",
        network: "ETHEREUM",
        displayName: "x",
      }),
    ).toThrow(/Base, Polygon, or Stellar/);
  });

  it("opens USDT on Base and Polygon", () => {
    expect(
      buildStablecoinOpenPayload({
        currency: "usdt",
        network: "POLYGON",
        displayName: "Ops USDT",
      }),
    ).toEqual({
      asset_type: "stablecoin",
      currency: "USDT",
      network: "Polygon",
      display_name: "Ops USDT",
    });
  });
});

describe("listed vs sendable stablecoin accounts", () => {
  it("lists pending Base USDC but does not mark it sendable", () => {
    const pending = normalizeFinancialAccount(
      {
        id: "acct_poly",
        asset_type: "stablecoin",
        currency: "USDC",
        network: "Polygon",
        status: "pending",
      },
      "ent_1",
    )!;
    expect(isListedStablecoinAccount(pending)).toBe(true);
    expect(isSendableStablecoinAccount(pending)).toBe(false);
  });

  it("forwards partner balance when present", () => {
    const acct = normalizeFinancialAccount(
      {
        id: "65",
        asset_type: "stablecoin",
        currency: "USDC",
        network: "Base",
        status: "active",
        balance: { available: "337.54", current: "337.54", currency: "USDC" },
      },
      "20",
    )!;
    expect(acct.balance).toEqual({
      available: "337.54",
      current: "337.54",
      currency: "USDC",
    });
  });
});

describe("occupiedStablecoinNetworkCodes", () => {
  it("marks supported network slots per currency", async () => {
    const { occupiedStablecoinNetworkCodes, occupiedStablecoinSlots, isStablecoinNetworkOccupied } =
      await import("./entities");
    const base = normalizeFinancialAccount(
      {
        id: "a1",
        asset_type: "stablecoin",
        currency: "USDC",
        network: "Base",
        status: "active",
      },
      "ent_1",
    )!;
    expect([...occupiedStablecoinNetworkCodes([base])]).toEqual(["BASE"]);
    expect(isStablecoinNetworkOccupied([base], "BASE")).toBe(true);
    expect(isStablecoinNetworkOccupied([base], "POLYGON")).toBe(false);
    expect(isStablecoinNetworkOccupied([base], "BASE", "USDT")).toBe(false);
    expect([...occupiedStablecoinSlots([base])]).toEqual(["USDC:BASE"]);

    const stellar = normalizeFinancialAccount(
      {
        id: "a2",
        asset_type: "stablecoin",
        currency: "USDC",
        network: "Stellar",
        status: "active",
      },
      "ent_1",
    )!;
    const usdtPoly = normalizeFinancialAccount(
      {
        id: "a3",
        asset_type: "stablecoin",
        currency: "USDT",
        network: "Polygon",
        status: "active",
      },
      "ent_1",
    )!;
    expect([...occupiedStablecoinNetworkCodes([base, stellar])]).toEqual([
      "BASE",
      "STELLAR",
    ]);
    expect([...occupiedStablecoinNetworkCodes([base, usdtPoly], "USDT")]).toEqual([
      "POLYGON",
    ]);
  });
});

describe("closed stablecoin accounts", () => {
  it("labels closed wallets and keeps the rail occupied", () => {
    const closed = normalizeFinancialAccount(
      {
        id: "67",
        asset_type: "stablecoin",
        currency: "USDC",
        network: "Stellar",
        status: "closed",
      },
      "ent_1",
    )!;
    expect(isClosedStatus(closed.status)).toBe(true);
    expect(isCloseableStablecoinAccount(closed)).toBe(true);
    expect(isSendableStablecoinAccount(closed)).toBe(false);
    expect(describeStablecoinAccountStatus(closed.status)).toBe("Closed");
    expect([...occupiedStablecoinNetworkCodes([closed])]).toEqual(["STELLAR"]);
  });
});

describe("resolvePrimaryEntityId", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the first entity id", async () => {
    vi.spyOn(entitiesApi, "list").mockResolvedValue([
      { id: "ent_a", customer_ref: null, entity_type: "business", status: "active" },
      { id: "ent_b", customer_ref: null, entity_type: "business", status: "active" },
    ]);
    await expect(resolvePrimaryEntityId()).resolves.toBe("ent_a");
  });

  it("errors when no entities exist", async () => {
    vi.spyOn(entitiesApi, "list").mockResolvedValue([]);
    await expect(resolvePrimaryEntityId()).rejects.toThrow(/partner entity/);
  });
});

describe("listStablecoinAccounts", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches per-entity accounts in parallel", async () => {
    const { listStablecoinAccounts } = await import("./entities");
    vi.spyOn(entitiesApi, "list").mockResolvedValue([
      { id: "10", customer_ref: null, entity_type: "business", status: "active" },
      { id: "20", customer_ref: null, entity_type: "business", status: "active" },
    ]);

    let inFlight = 0;
    let maxInFlight = 0;
    vi.spyOn(entitiesApi, "listAccounts").mockImplementation(async (entityId: string) => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 20));
      inFlight -= 1;
      return [
        {
          id: `acct-${entityId}`,
          asset_type: "stablecoin",
          currency: "USDC",
          network: entityId === "10" ? "Base" : "Polygon",
          status: "active",
          wallet_address: `0x${entityId}`,
        },
      ];
    });

    const accounts = await listStablecoinAccounts();
    expect(accounts).toHaveLength(2);
    expect(maxInFlight).toBe(2);
  });
});

describe("balance normalization", () => {
  const normalize = (balance: unknown) =>
    normalizeFinancialAccount(
      { id: "65", asset_type: "stablecoin", currency: "USDC", network: "Base", status: "active", balance },
      "20",
    )!.balance;

  it("drops amounts that do not parse to a finite number", () => {
    expect(normalize({ available: "n/a", current: Number.NaN })).toEqual({
      available: null,
      current: null,
      currency: "USDC",
    });
    expect(normalize({ available: Number.POSITIVE_INFINITY })).toMatchObject({
      available: null,
    });
  });

  it("keeps well-formed amounts verbatim", () => {
    expect(normalize({ available: "337.54", current: 12 })).toMatchObject({
      available: "337.54",
      current: "12",
    });
  });
});
