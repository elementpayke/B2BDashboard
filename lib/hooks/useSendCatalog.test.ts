import { describe, expect, it } from "vitest";
import { ApiRequestError } from "@/lib/apiClient";
import { shouldRetryCatalog } from "./useSendCatalog";

describe("shouldRetryCatalog", () => {
  it("retries gateway timeouts up to twice", () => {
    const err = new ApiRequestError("Upstream request timed out. Please try again.", 504);
    expect(shouldRetryCatalog(0, err)).toBe(true);
    expect(shouldRetryCatalog(1, err)).toBe(true);
    expect(shouldRetryCatalog(2, err)).toBe(false);
  });

  it("does not retry auth or validation failures", () => {
    expect(shouldRetryCatalog(0, new ApiRequestError("Bad request", 400))).toBe(false);
    expect(shouldRetryCatalog(0, new ApiRequestError("Unauthorized", 401))).toBe(false);
  });
});
