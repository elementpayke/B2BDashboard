import { NextRequest } from "next/server";
import { jsonError, jsonSuccess, requireSessionBusiness } from "@/lib/server/session";
import { deleteInvoiceCustomer } from "@/lib/server/invoiceCustomersStore";

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await requireSessionBusiness(request);
  if (session instanceof Response) return session;
  const { id } = await context.params;
  const ok = await deleteInvoiceCustomer(session.businessId, id);
  if (!ok) return jsonError(404, "Customer not found", session);
  return jsonSuccess(null, { message: "Deleted", session });
}
