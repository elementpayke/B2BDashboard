import { afterEach, describe, expect, it, vi } from "vitest";
import {
  MBOKA_SIGNATURE_HEADER,
  MBOKA_SIGNATURE_TIMESTAMP_HEADER,
  buildMbokaSignatureHeaders,
  hashRequestBody,
  signMbokaRequest,
} from "./mbokaSignature";

describe("hashRequestBody", () => {
  it("hashes an empty body the same way whether null, undefined, or an empty string", () => {
    const empty = hashRequestBody(null);
    expect(hashRequestBody(undefined)).toBe(empty);
    expect(hashRequestBody("")).toBe(empty);
    // Well-known SHA-256 of the empty string.
    expect(empty).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
  });

  it("hashes a string body deterministically", () => {
    const a = hashRequestBody('{"currency":"USD"}');
    const b = hashRequestBody('{"currency":"USD"}');
    const c = hashRequestBody('{"currency":"EUR"}');
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it("hashes raw bytes (Uint8Array) the same as the equivalent UTF-8 string", () => {
    const text = "hello world";
    const bytes = new TextEncoder().encode(text);
    expect(hashRequestBody(bytes)).toBe(hashRequestBody(text));
  });

  it("is binary-safe for non-UTF-8 bytes (e.g. multipart uploads) rather than lossily decoding them", () => {
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]); // JPEG-ish magic bytes
    expect(() => hashRequestBody(bytes)).not.toThrow();
    expect(hashRequestBody(bytes)).toHaveLength(64);
  });
});

describe("signMbokaRequest", () => {
  it("produces the same signature for the same inputs", () => {
    const sig1 = signMbokaRequest("shh", "POST", "/api/v1/iban/accounts", "bodyhash", "1700000000000");
    const sig2 = signMbokaRequest("shh", "POST", "/api/v1/iban/accounts", "bodyhash", "1700000000000");
    expect(sig1).toBe(sig2);
    expect(sig1).toHaveLength(64);
  });

  it("changes when the secret, method, path, body hash, or timestamp changes", () => {
    const base = signMbokaRequest("shh", "POST", "/api/v1/iban/accounts", "bodyhash", "1700000000000");
    expect(signMbokaRequest("different", "POST", "/api/v1/iban/accounts", "bodyhash", "1700000000000")).not.toBe(base);
    expect(signMbokaRequest("shh", "GET", "/api/v1/iban/accounts", "bodyhash", "1700000000000")).not.toBe(base);
    expect(signMbokaRequest("shh", "POST", "/api/v1/other", "bodyhash", "1700000000000")).not.toBe(base);
    expect(signMbokaRequest("shh", "POST", "/api/v1/iban/accounts", "different-hash", "1700000000000")).not.toBe(base);
    expect(signMbokaRequest("shh", "POST", "/api/v1/iban/accounts", "bodyhash", "1700000000001")).not.toBe(base);
  });

  it("normalizes method case so GET and get sign identically", () => {
    const upper = signMbokaRequest("shh", "GET", "/api/v1/x", "h", "1");
    const lower = signMbokaRequest("shh", "get", "/api/v1/x", "h", "1");
    expect(upper).toBe(lower);
  });
});

describe("buildMbokaSignatureHeaders", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns null when no shared secret is configured — signing is a no-op until the backend ships it", () => {
    vi.stubEnv("MBOKA_PROXY_SHARED_SECRET", "");
    expect(buildMbokaSignatureHeaders("POST", "/api/v1/iban/accounts", "{}")).toBeNull();
  });

  it("returns both headers, with the signature matching signMbokaRequest over the same inputs", () => {
    vi.stubEnv("MBOKA_PROXY_SHARED_SECRET", "test-secret");
    const headers = buildMbokaSignatureHeaders("POST", "/api/v1/iban/accounts", '{"currency":"USD"}');
    expect(headers).not.toBeNull();
    const timestamp = headers![MBOKA_SIGNATURE_TIMESTAMP_HEADER];
    const bodyHash = hashRequestBody('{"currency":"USD"}');
    const expected = signMbokaRequest(
      "test-secret",
      "POST",
      "/api/v1/iban/accounts",
      bodyHash,
      timestamp,
    );
    expect(headers![MBOKA_SIGNATURE_HEADER]).toBe(expected);
  });

  it("is internally self-consistent across repeated calls (fresh timestamp each time, not cached)", () => {
    vi.stubEnv("MBOKA_PROXY_SHARED_SECRET", "test-secret");
    for (const headers of [
      buildMbokaSignatureHeaders("GET", "/api/v1/x", null),
      buildMbokaSignatureHeaders("GET", "/api/v1/x", null),
    ]) {
      expect(headers).not.toBeNull();
      expect(headers![MBOKA_SIGNATURE_HEADER]).toBe(
        signMbokaRequest(
          "test-secret",
          "GET",
          "/api/v1/x",
          hashRequestBody(null),
          headers![MBOKA_SIGNATURE_TIMESTAMP_HEADER],
        ),
      );
    }
  });
});
