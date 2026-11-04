import { describe, expect, it } from "vitest";
import { readLogoFile } from "./invoiceBranding";

describe("readLogoFile", () => {
  it("rejects non-image files", async () => {
    const file = new File(["x"], "doc.txt", { type: "text/plain" });
    await expect(readLogoFile(file)).rejects.toThrow(/PNG or JPEG/);
  });
});
