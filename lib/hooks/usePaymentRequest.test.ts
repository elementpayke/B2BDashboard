import { describe, expect, it } from "vitest";
import { newPaymentRequestRef, paymentRequestStage } from "./usePaymentRequest";

describe("paymentRequestStage", () => {
  it("is received only once the request settles", () => {
    expect(paymentRequestStage("settled")).toBe("received");
    expect(paymentRequestStage("pending_settlement")).toBe("waiting");
  });

  it("waits while the payer hasn't answered", () => {
    for (const status of ["awaiting_payer", "awaiting_user", "processing", "", null, undefined]) {
      expect(paymentRequestStage(status)).toBe("waiting");
    }
  });

  it("treats every other final status as not completed", () => {
    for (const status of ["failed", "expired", "cancelled", "FAILED"]) {
      expect(paymentRequestStage(status)).toBe("failed");
    }
  });
});

describe("newPaymentRequestRef", () => {
  it("mints a distinct pr- reference each time", () => {
    const a = newPaymentRequestRef();
    expect(a).toMatch(/^pr-/);
    expect(newPaymentRequestRef()).not.toBe(a);
  });
});
