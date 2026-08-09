import { NextRequest } from "next/server";
import {
  jsonError,
  jsonSuccess,
  requireSessionBusiness,
} from "@/lib/server/session";
import { deleteSavedRecipient } from "@/lib/server/savedRecipientsStore";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(request: NextRequest, context: RouteContext) {
  const session = await requireSessionBusiness(request);
  if (session instanceof Response) return session;

  const { id } = await context.params;
  if (!id?.trim()) {
    return jsonError(400, "id is required", session);
  }

  const removed = await deleteSavedRecipient(session.businessId, id.trim());
  if (!removed) {
    // Same message for missing + other-business to avoid id enumeration.
    return jsonError(404, "Saved recipient not found", session);
  }

  return jsonSuccess(null, { message: "Deleted", session });
}
