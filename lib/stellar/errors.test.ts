import { describe, expect, it } from "vitest";
import { formatStellarWalletError, isWalletModalClosed } from "./errors";

describe("stellar wallet errors", () => {
  it("treats modal close as a cancel", () => {
    expect(isWalletModalClosed({ message: "The user closed the modal." })).toBe(true);
    expect(formatStellarWalletError({ message: "The user closed the modal." })).toBe("");
  });

  it("does not treat Horizon transaction rejected as a cancel", () => {
    expect(isWalletModalClosed({ message: "transaction rejected" })).toBe(false);
    expect(isWalletModalClosed({ message: "User rejected the request" })).toBe(true);
  });

  it("keeps formatting when getResultCodes throws", () => {
    expect(
      formatStellarWalletError({
        message: "Horizon timeout",
        getResultCodes: () => {
          throw new Error("decode failed");
        },
      }),
    ).toBe("Horizon timeout");
  });

  it("maps underfunded Horizon codes", () => {
    expect(
      formatStellarWalletError({
        message: "tx failed",
        getResultCodes: () => ({ operations: ["op_underfunded"] }),
      }),
    ).toMatch(/Not enough USDC/);
  });
});
