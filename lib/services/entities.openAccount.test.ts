import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  buildStablecoinOpenPayload,
  isListedStablecoinAccount,
  isSendableStablecoinAccount,
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
        currency: "USDT",
        network: "BASE",
        displayName: "x",
      }),
    ).toThrow(/USDC/);
    expect(() =>
      buildStablecoinOpenPayload({
        currency: "USDC",
        network: "ETHEREUM",
        displayName: "x",
      }),
    ).toThrow(/Base, Polygon, or Stellar/);
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
  it("marks supported USDC network slots once when accounts exist", async () => {
    const { occupiedStablecoinNetworkCodes, isStablecoinNetworkOccupied } =
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
    expect([...occupiedStablecoinNetworkCodes([base, stellar])]).toEqual([
      "BASE",
      "STELLAR",
    ]);
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
