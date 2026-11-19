import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import { buildMbokaUrl, mboka, type MbokaData, type MbokaSchema } from "./mboka";
import { MBOKA_PROXY_ALLOWED_PREFIXES } from "@/lib/server/mbokaProxyAllowlist";
import spec from "./openapi.json";

afterEach(() => vi.unstubAllGlobals());

function stubFetch(data: unknown) {
  const fetchMock = vi.fn(async () =>
    new Response(JSON.stringify({ status: "success", message: "ok", data }), { status: 200 }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("buildMbokaUrl", () => {
  it("fills and encodes path params and appends defined query values", () => {
    expect(
      buildMbokaUrl("/v1/transactions/{transaction_id}", { transaction_id: "acr_1/2" }, {
        status: "completed",
        offset: 0,
        skip: undefined,
        tag: ["a", "b"],
      }),
    ).toBe("/v1/transactions/acr_1%2F2?status=completed&offset=0&tag=a&tag=b");
  });

  it("refuses to call a template with a missing param", () => {
    expect(() => buildMbokaUrl("/v1/orders/{merchant_order_id}", {})).toThrow(/merchant_order_id/);
  });
});

describe("mboka client", () => {
  it("goes through the same-origin /api/mboka proxy and unwraps the envelope", async () => {
    const fetchMock = stubFetch({ id: 7 });
    const data = await mboka.get("/v1/transactions/{transaction_id}", { path: { transaction_id: "7" } });
    expect(data).toEqual({ id: 7 });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/mboka/v1/transactions/7",
      expect.objectContaining({ method: "GET", credentials: "same-origin" }),
    );
  });

  it("forwards JSON bodies and custom headers such as Idempotency-Key", async () => {
    const fetchMock = stubFetch({ quote_id: "q1" });
    await mboka.post("/v1/orders/quote", {
      body: {} as never,
      headers: { "Idempotency-Key": "k-1" },
    });
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["Idempotency-Key"]).toBe("k-1");
  });
});

describe("spec snapshot", () => {
  it("only contains paths the BFF proxy allows (keeps scripts/fetch-openapi.mjs in sync)", () => {
    const prefixes = new Set(Object.keys(spec.paths).map((p) => p.split("/")[1]));
    for (const prefix of prefixes) {
      expect(MBOKA_PROXY_ALLOWED_PREFIXES).toContain(prefix);
    }
  });
});

// Compile-time contract (checked by `npm run typecheck`, never executed).
function _typeContract() {
  expectTypeOf<MbokaData<"/v1/bootstrap", "get">>().toEqualTypeOf<MbokaSchema<"BootstrapOut"> | null>();
  // @ts-expect-error — unknown path
  void mboka.get("/v1/not-a-real-endpoint");
  // @ts-expect-error — path params are required for templated paths
  void mboka.get("/v1/transactions/{transaction_id}");
  // @ts-expect-error — GET-only endpoint can't be POSTed
  void mboka.post("/v1/bootstrap");
}
void _typeContract;
