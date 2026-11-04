import { NextRequest } from "next/server";
import { jsonError, jsonSuccess, requireSessionBusiness } from "@/lib/server/session";
import {
  createInvoiceCustomer,
  listInvoiceCustomers,
} from "@/lib/server/invoiceCustomersStore";
import { parseCreateInvoiceCustomerInput } from "@/lib/services/invoiceCustomers";

export async function GET(request: NextRequest) {
  const session = await requireSessionBusiness(request);
  if (session instanceof Response) return session;
  const items = await listInvoiceCustomers(session.businessId);
  return jsonSuccess({ items, total: items.length }, { message: "ok", session });
}

export async function POST(request: NextRequest) {
  const session = await requireSessionBusiness(request);
  if (session instanceof Response) return session;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid JSON body", session);
  }
  const parsed = parseCreateInvoiceCustomerInput(body);
  if (parsed.ok === false) {
    return jsonError(400, parsed.message, session);
  }
  const created = await createInvoiceCustomer(session.businessId, parsed.value);
  return jsonSuccess(created, { status: 201, message: "Created", session });
}
