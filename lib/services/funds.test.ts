import { describe, expect, it } from "vitest";
import {
  isAfricaFundProcessing,
  isAfricaFundTerminal,
} from "./funds";

describe("africa fund status helpers", () => {
  it("treats mid-pipeline statuses as processing", () => {
    expect(isAfricaFundProcessing("awaiting_stable")).toBe(true);
    expect(isAfricaFundProcessing("converting")).toBe(true);
    expect(isAfricaFundProcessing("completed")).toBe(false);
  });

  it("treats completed/failed/partial as terminal", () => {
    expect(isAfricaFundTerminal("completed")).toBe(true);
    expect(isAfricaFundTerminal("partial")).toBe(true);
    expect(isAfricaFundTerminal("onramp_processing")).toBe(false);
  });
});
