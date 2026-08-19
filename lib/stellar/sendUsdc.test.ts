import { describe, expect, it } from "vitest";
import { remapUnfundedSourceError } from "./sendUsdc";

describe("remapUnfundedSourceError", () => {
  it("maps Horizon not-found to the unfunded-wallet message", () => {
    expect(() => remapUnfundedSourceError({ name: "NotFoundError" })).toThrow(
      /not funded on Stellar/,
    );
    expect(() => remapUnfundedSourceError({ response: { status: 404 } })).toThrow(
      /not funded on Stellar/,
    );
  });

  it("rethrows transport failures", () => {
    const err = new Error("Horizon timeout");
    expect(() => remapUnfundedSourceError(err)).toThrow(err);
  });
});
