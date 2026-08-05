import { describe, it, expect } from "vitest";
import { buildSimpleDraftPayload } from "./invoices";

describe("buildSimpleDraftPayload", () => {
  it("builds a minimal valid DraftPayloadIn from the dashboard's simple client+amount form", () => {
    const payload = buildSimpleDraftPayload("Acme GmbH", "4500.00");
    expect(payload.currency).toBe("USD");
    expect(payload.client_name).toBe("Acme GmbH");
    expect(payload.line_items).toHaveLength(1);
    expect(payload.line_items[0]).toMatchObject({ description: "Acme GmbH", quantity: 1, unit_amount: "4500.00" });
  });
});
