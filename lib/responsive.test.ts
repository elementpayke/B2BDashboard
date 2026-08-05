import { describe, expect, it } from "vitest";
import { getBreakpoint, isCompactWidth, BP } from "@/lib/responsive";

describe("responsive breakpoints", () => {
  it("classifies the contracted viewport bands", () => {
    expect(getBreakpoint(319)).toBe("mobile");
    expect(getBreakpoint(639)).toBe("mobile");
    expect(getBreakpoint(640)).toBe("tablet");
    expect(getBreakpoint(1023)).toBe("tablet");
    expect(getBreakpoint(1024)).toBe("desktop");
    expect(getBreakpoint(1439)).toBe("desktop");
    expect(getBreakpoint(1440)).toBe("large");
  });

  it("uses compact chrome below desktop", () => {
    expect(isCompactWidth(BP.mobile - 1)).toBe(true);
    expect(isCompactWidth(900)).toBe(true);
    expect(isCompactWidth(BP.desktop - 1)).toBe(true);
    expect(isCompactWidth(BP.desktop)).toBe(false);
  });
});
