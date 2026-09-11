/** @vitest-environment jsdom */
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { applyThemeVars, clearThemeVars } from "./applyThemeVars";

describe("applyThemeVars", () => {
  beforeEach(() => {
    clearThemeVars(["--bg", "--panel", "--ink"]);
  });

  afterEach(() => {
    clearThemeVars(["--bg", "--panel", "--ink"]);
  });

  it("writes CSS variables and theme metadata onto documentElement", () => {
    applyThemeVars(
      {
        "--bg": "#000000",
        "--panel": "#121116",
        "--ink": "#F2F0FA",
      },
      "dark",
    );
    expect(document.documentElement.style.getPropertyValue("--bg")).toBe("#000000");
    expect(document.documentElement.style.getPropertyValue("--panel")).toBe("#121116");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");
  });

  it("switches back to light tokens", () => {
    applyThemeVars({ "--bg": "#000000", "--panel": "#121116" }, "dark");
    applyThemeVars({ "--bg": "#F6F4EF", "--panel": "#FFFFFF" }, "light");
    expect(document.documentElement.style.getPropertyValue("--bg")).toBe("#F6F4EF");
    expect(document.documentElement.dataset.theme).toBe("light");
  });
});
