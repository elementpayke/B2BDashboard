import { describe, expect, it } from "vitest";
import { formatStellarWalletError, isWalletModalClosed } from "./errors";

describe("stellar wallet errors", () => {
  it("treats modal close as a cancel", () => {
    expect(isWalletModalClosed({ message: "The user closed the modal." })).toBe(true);
    expect(formatStellarWalletError({ message: "The user closed the modal." })).toBe("");
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
