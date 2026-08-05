import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

describe("GET /api/mboka/[...path]", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("blocks server-to-server webhook routes from being reached through the user-facing proxy, without ever calling fetch", async () => {
    const req = new NextRequest("http://localhost:3000/api/mboka/webhooks/aggregator/orders");
    const res = await GET(req, { params: Promise.resolve({ path: ["webhooks", "aggregator", "orders"] }) });

    expect(res.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("blocks the kyb webhook route specifically (nested under businesses)", async () => {
    const req = new NextRequest("http://localhost:3000/api/mboka/webhooks/kyb");
    const res = await GET(req, { params: Promise.resolve({ path: ["webhooks", "kyb"] }) });

    expect(res.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("forwards ordinary authenticated routes straight through to the backend path 1:1", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ status: "success", message: "ok", data: { total: 0 } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const req = new NextRequest("http://localhost:3000/api/mboka/v1/transactions?limit=10");
    await GET(req, { params: Promise.resolve({ path: ["v1", "transactions"] }) });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain("/api/v1/transactions?limit=10");
  });
});
