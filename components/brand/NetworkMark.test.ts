import { describe, expect, it } from "vitest";
import { partnerNetworkForMark } from "./NetworkMark";

describe("partnerNetworkForMark", () => {
  it("maps Base, Polygon, and Stellar spellings", () => {
    expect(partnerNetworkForMark("base")).toBe("Base");
    expect(partnerNetworkForMark("Base")).toBe("Base");
    expect(partnerNetworkForMark("polygon")).toBe("Polygon");
    expect(partnerNetworkForMark("stellar_public")).toBe("Stellar");
    expect(partnerNetworkForMark("stellar_testnet")).toBe("Stellar");
  });

  it("returns null for fiat or unknown rails", () => {
    expect(partnerNetworkForMark("KES")).toBeNull();
    expect(partnerNetworkForMark("")).toBeNull();
    expect(partnerNetworkForMark(null)).toBeNull();
  });
});
