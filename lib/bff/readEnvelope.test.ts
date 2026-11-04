import { describe, expect, it } from "vitest";
import { readBffEnvelope } from "./readEnvelope";

describe("readBffEnvelope", () => {
  it("parses success body once", async () => {
    const res = new Response(JSON.stringify({ status: "success", data: { id: "x" } }), {
      status: 201,
    });
    const parsed = await readBffEnvelope<{ id: string }>(res);
    expect(parsed.ok).toBe(true);
    expect(parsed.envelope?.data?.id).toBe("x");
  });

  it("handles empty error body without throwing", async () => {
    const res = new Response("", { status: 502 });
    const parsed = await readBffEnvelope(res);
    expect(parsed.ok).toBe(false);
    expect(parsed.envelope).toBeNull();
  });
});
