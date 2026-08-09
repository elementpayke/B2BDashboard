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
  it("maps UI network codes to partner Base/Polygon", () => {
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
    ).toThrow(/Base or Polygon/);
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
});

describe("occupiedStablecoinNetworkCodes", () => {
  it("marks Base/Polygon once when a USDC account exists there", async () => {
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
