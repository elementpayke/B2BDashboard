import { describe, expect, it } from "vitest";
import { billingAddressFromKyb } from "./CardDetailModal";

describe("billingAddressFromKyb", () => {
  it("returns null without street/city", () => {
    expect(billingAddressFromKyb(null)).toBeNull();
    expect(
      billingAddressFromKyb({
        street: "",
        city: "Miami",
        post_code: "33179",
        country: "US",
      }),
    ).toBeNull();
  });

  it("formats registered address for display and copy", () => {
    expect(
      billingAddressFromKyb({
        street: "390 NE 191ST ST",
        street2: "STE 8972",
        city: "MIAMI",
        state: "FL",
        post_code: "33179",
        country: "US",
      }),
    ).toEqual({
      line1: "390 NE 191ST ST, STE 8972",
      line2: "MIAMI, FL, 33179 · US",
      copyText: "390 NE 191ST ST\nSTE 8972\nMIAMI, FL, 33179\nUS",
    });
  });
});
