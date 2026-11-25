import type { InvoiceCustomer } from "@/lib/services/invoiceCustomers";
import { bffErrorMessage, readBffEnvelope } from "@/lib/bff/readEnvelope";

export async function fetchInvoiceCustomers(): Promise<InvoiceCustomer[]> {
  const res = await fetch("/api/invoice-customers", { credentials: "same-origin" });
  const parsed = await readBffEnvelope<{ items: InvoiceCustomer[] }>(res);
  if (!parsed.ok) return [];
  return parsed.envelope?.data?.items ?? [];
}

export async function createInvoiceCustomer(input: {
  name: string;
  email: string;
  country?: string | null;
}): Promise<InvoiceCustomer> {
  const res = await fetch("/api/invoice-customers", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const parsed = await readBffEnvelope<InvoiceCustomer>(res);
  if (!parsed.ok || !parsed.envelope?.data) {
    throw new Error(bffErrorMessage(parsed.status, parsed.envelope, "Could not save customer"));
  }
  return parsed.envelope.data;
}
