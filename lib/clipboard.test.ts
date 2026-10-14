// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { copyText } from "./clipboard";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function stubClipboard(writeText: ((v: string) => Promise<void>) | undefined) {
  vi.stubGlobal("navigator", { ...navigator, clipboard: writeText ? { writeText } : undefined });
}

describe("copyText", () => {
  it("uses the async clipboard API when it works", async () => {
    const writeText = vi.fn(async () => undefined);
    stubClipboard(writeText);
    const exec = vi.fn(() => true);
    document.execCommand = exec;
    expect(await copyText("5412753490214471")).toBe(true);
    expect(writeText).toHaveBeenCalledWith("5412753490214471");
    expect(exec).not.toHaveBeenCalled();
  });

  it("falls back to execCommand when the clipboard API is missing", async () => {
    stubClipboard(undefined);
    let copied = "";
    document.execCommand = vi.fn(() => {
      copied = (document.activeElement as HTMLTextAreaElement).value;
      return true;
    });
    expect(await copyText("318")).toBe(true);
    expect(copied).toBe("318");
    // The helper textarea never lingers in the page.
    expect(document.querySelector("textarea")).toBeNull();
  });

  it("falls back when the clipboard API rejects", async () => {
    stubClipboard(async () => {
      throw new Error("NotAllowedError");
    });
    document.execCommand = vi.fn(() => true);
    expect(await copyText("09/29")).toBe(true);
  });

  it("reports failure when nothing could copy", async () => {
    stubClipboard(undefined);
    document.execCommand = vi.fn(() => false);
    expect(await copyText("x")).toBe(false);
  });
});
