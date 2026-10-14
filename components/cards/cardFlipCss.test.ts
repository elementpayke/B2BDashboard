import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Guards the CSS half of the copy fix: JSDOM can't hit-test 3D transforms, so
// assert the rules that keep the turned-away face from swallowing taps.
const css = readFileSync(path.join(process.cwd(), "app/globals.css"), "utf8");

describe("card flip CSS", () => {
  const hiddenFaceSelector =
    /\.ep-card-flip__inner\[data-flipped="true"\] \.ep-card-flip__face--front,\s*\.ep-card-flip__inner:not\(\[data-flipped="true"\]\) \.ep-card-flip__face--back\s*\{([^}]*)\}/g;

  it("takes the hidden face out of hit-testing and out of view", () => {
    const bodies = [...css.matchAll(hiddenFaceSelector)].map((m) => m[1]);
    expect(bodies.some((b) => /pointer-events:\s*none/.test(b))).toBe(true);
    expect(bodies.some((b) => /visibility:\s*hidden/.test(b))).toBe(true);
  });

  it("scales card text with the card's own width", () => {
    expect(css).toMatch(/\.ep-card-flip,\s*\.ep-card-preview\s*\{[^}]*container-type:\s*inline-size/);
    expect(css).toMatch(/\.ep-card-face__label\s*\{[^}]*font-size:\s*clamp\([^)]*cqi/);
  });
});
