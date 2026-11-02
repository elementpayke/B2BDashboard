import { describe, expect, it } from "vitest";
import { describeDisbursementStatus, isTerminalDisbursementStatus } from "./disbursementStatus";

describe("describeDisbursementStatus", () => {
  it("maps known statuses to a label/color/terminal descriptor", () => {
    expect(describeDisbursementStatus("completed")).toMatchObject({
      label: "Completed",
      terminal: true,
    });
    expect(describeDisbursementStatus("processing")).toMatchObject({
      label: "Processing",
      terminal: false,
    });
    expect(describeDisbursementStatus("partially_failed")).toMatchObject({
      label: "Partially failed",
      terminal: true,
    });
  });

  it("is case-insensitive", () => {
    expect(describeDisbursementStatus("COMPLETED").label).toBe("Completed");
  });

  it("falls back to a safe unknown descriptor for unrecognized/missing status", () => {
    expect(describeDisbursementStatus("something_new").label).toBe("Unknown");
    expect(describeDisbursementStatus(null).label).toBe("Unknown");
    expect(describeDisbursementStatus(undefined).label).toBe("Unknown");
  });
});

describe("isTerminalDisbursementStatus", () => {
  it("reflects the descriptor's terminal flag", () => {
    expect(isTerminalDisbursementStatus("processing")).toBe(false);
    expect(isTerminalDisbursementStatus("completed")).toBe(true);
    expect(isTerminalDisbursementStatus("failed")).toBe(true);
  });
});
