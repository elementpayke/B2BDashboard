import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  apiEnvelope,
  apiUpload,
  authEnvelope,
  ApiRequestError,
  SessionExpiredError,
  isSessionExpiredError,
  setSessionLostHandler,
} from "./apiClient";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("apiClient", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    setSessionLostHandler(null);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns data on a successful envelope", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { status: "success", message: "ok", data: { id: 1 } }));
    const data = await apiEnvelope<{ id: number }>("GET", "/v1/dashboard/summary");
    expect(data).toEqual({ id: 1 });
  });

  it("calls the proxy prefix, not the backend directly", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { status: "success", message: "ok", data: {} }));
    await apiEnvelope("GET", "/v1/transactions");
    expect(fetchMock.mock.calls[0][0]).toBe("/api/mboka/v1/transactions");
  });

  it("throws ApiRequestError with the backend's message on a non-success envelope", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(400, { status: "error", message: "Bad request", data: null }));
    await expect(apiEnvelope("GET", "/v1/transactions")).rejects.toMatchObject({
      name: "ApiRequestError",
      message: "Bad request",
      status: 400,
    });
  });

  it("throws SessionExpiredError on a 401 and notifies the registered session-lost handler", async () => {
    const handler = vi.fn();
    setSessionLostHandler(handler);
    fetchMock.mockResolvedValueOnce(jsonResponse(401, { status: "error", message: "not authenticated", data: null }));

    await expect(apiEnvelope("GET", "/v1/transactions")).rejects.toBeInstanceOf(SessionExpiredError);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("classifies an auth-failure message as SessionExpiredError even on a non-401 status", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { status: "error", message: "Invalid JWT token", data: null }));
    await expect(apiEnvelope("GET", "/v1/transactions")).rejects.toBeInstanceOf(SessionExpiredError);
  });

  it("returns null on a successful envelope with intentional empty data (DELETE)", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { status: "success", message: "deleted", data: null }));
    await expect(apiEnvelope<null>("DELETE", "/api-keys/1")).resolves.toBeNull();
  });

  it("throws ApiRequestError when a success envelope omits the data field entirely", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { status: "success", message: "ok" }));
    await expect(apiEnvelope("GET", "/v1/transactions")).rejects.toBeInstanceOf(ApiRequestError);
  });

  it("degrades gracefully on a non-JSON response, classifying 401 as session-expired", async () => {
    fetchMock.mockResolvedValueOnce(new Response("not json", { status: 401 }));
    await expect(apiEnvelope("GET", "/v1/transactions")).rejects.toBeInstanceOf(SessionExpiredError);
  });

  it("isSessionExpiredError recognizes both the class and duck-typed objects", () => {
    expect(isSessionExpiredError(new SessionExpiredError())).toBe(true);
    expect(isSessionExpiredError({ sessionExpired: true })).toBe(true);
    expect(isSessionExpiredError(new ApiRequestError("x", 400))).toBe(false);
    expect(isSessionExpiredError(null)).toBe(false);
  });

  it("authEnvelope calls the exact path given (not proxy-prefixed) — used for our dedicated /api/auth/* routes", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { status: "success", message: "ok", data: { ok: true } }));
    await authEnvelope("POST", "/api/auth/login", { email: "a@b.com", password: "x" });
    expect(fetchMock.mock.calls[0][0]).toBe("/api/auth/login");
  });

  it("apiUpload sends the FormData body through the proxy without forcing a JSON content-type", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(201, { status: "success", message: "ok", data: { id: 1 } }));
    const form = new FormData();
    form.set("document_type", "certificate_of_incorporation");
    const data = await apiUpload<{ id: number }>("POST", "/businesses/1/kyb/documents", form);
    expect(data).toEqual({ id: 1 });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/mboka/businesses/1/kyb/documents");
    expect(init.body).toBe(form);
    expect(init.headers).toBeUndefined();
  });

  it("apiUpload surfaces backend validation errors from the envelope", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(422, { status: "error", message: "Unsupported file type.", data: null }));
    await expect(apiUpload("POST", "/businesses/1/kyb/documents", new FormData())).rejects.toMatchObject({
      name: "ApiRequestError",
      message: "Unsupported file type.",
      status: 422,
    });
  });
});
