import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const store = vi.hoisted(() => ({
  listInvoiceCustomers: vi.fn(),
  createInvoiceCustomer: vi.fn(),
}));
vi.mock("@/lib/server/invoiceCustomersStore", () => store);
vi.mock("@/lib/server/session", async () => {
  const { NextResponse } = await import("next/server");
  return {
    requireSessionBusiness: vi.fn(async () => ({ businessId: 42 })),
    jsonSuccess: (data: unknown, init?: { status?: number }) =>
      NextResponse.json({ status: "success", message: "ok", data }, { status: init?.status ?? 200 }),
    jsonError: (status: number, message: string) =>
      NextResponse.json({ status: "error", message, data: null }, { status }),
  };
});

import { GET, POST } from "./route";

const ORIGIN = "http://localhost:3000";

describe("/api/invoice-customers", () => {
  beforeEach(() => {
    store.listInvoiceCustomers.mockReset().mockResolvedValue([]);
    store.createInvoiceCustomer.mockReset().mockResolvedValue({
      id: "cust-1",
      businessId: 42,
      name: "Jane",
      email: "j@example.com",
      country: "KE",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
  });

  it("GET lists customers for the session business", async () => {
    const res = await GET(new NextRequest(`${ORIGIN}/api/invoice-customers`));
    const json = await res.json();
    expect(json.data.items).toEqual([]);
    expect(store.listInvoiceCustomers).toHaveBeenCalledWith(42);
  });

  it("POST returns 503 when store throws", async () => {
    store.createInvoiceCustomer.mockRejectedValueOnce(new Error("KV set failed"));
    const res = await POST(
      new NextRequest(`${ORIGIN}/api/invoice-customers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Jane", email: "j@example.com" }),
      }),
    );
    expect(res.status).toBe(503);
  });

  it("POST creates a customer and returns JSON envelope", async () => {
    const res = await POST(
      new NextRequest(`${ORIGIN}/api/invoice-customers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Jane", email: "j@example.com", country: "KE" }),
      }),
    );
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.status).toBe("success");
    expect(json.data.id).toBe("cust-1");
  });
});
