// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { openBrandedDocument } from "./brandedDocument";

describe("openBrandedDocument", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps a writable popup reference while severing its opener", () => {
    const write = vi.fn();
    const close = vi.fn();
    const popup = {
      opener: window,
      document: { write, close },
    };
    const open = vi
      .spyOn(window, "open")
      .mockReturnValue(popup as unknown as Window);

    openBrandedDocument(
      {
        fileTitle: "Receipt",
        heading: "Payment receipt",
        sections: [],
      },
      "receipt",
    );

    expect(open).toHaveBeenCalledWith("", "_blank");
    expect(popup.opener).toBeNull();
    expect(write).toHaveBeenCalledWith(expect.stringContaining("<title>Receipt</title>"));
    expect(close).toHaveBeenCalledOnce();
  });
});
