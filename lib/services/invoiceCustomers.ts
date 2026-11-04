export type InvoiceCustomer = {
  id: string;
  businessId: number;
  name: string;
  email: string;
  country?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type InvoiceCustomerCreate = {
  name: string;
  email: string;
  country?: string | null;
};

export function parseCreateInvoiceCustomerInput(body: unknown):
  | { ok: true; value: InvoiceCustomerCreate }
  | { ok: false; message: string } {
  if (typeof body !== "object" || body === null) {
    return { ok: false, message: "Invalid body" };
  }
  const o = body as Record<string, unknown>;
  const name = typeof o.name === "string" ? o.name.trim() : "";
  const email = typeof o.email === "string" ? o.email.trim() : "";
  if (!name) return { ok: false, message: "Name is required" };
  if (!email || !email.includes("@")) return { ok: false, message: "Valid email is required" };
  const country = typeof o.country === "string" ? o.country.trim() || null : null;
  return { ok: true, value: { name, email, country } };
}
