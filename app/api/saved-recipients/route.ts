import { NextRequest } from "next/server";
import {
  jsonError,
  jsonSuccess,
  requireSessionBusiness,
} from "@/lib/server/session";
import {
  createSavedRecipient,
  listSavedRecipients,
} from "@/lib/server/savedRecipientsStore";
import { parseCreateSavedRecipientInput } from "@/lib/services/savedRecipients";

export async function GET(request: NextRequest) {
  const session = await requireSessionBusiness(request);
  if (session instanceof Response) return session;

  const items = await listSavedRecipients(session.businessId);
  return jsonSuccess(
    { items, total: items.length },
    { message: "ok", session },
  );
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

  const parsed = parseCreateSavedRecipientInput(body);
  if (!parsed.ok) {
    return jsonError(400, parsed.message, session);
  }

  const created = await createSavedRecipient(session.businessId, parsed.value);
  if (!created.ok) {
    return jsonError(created.status, created.message, session);
  }

  return jsonSuccess(created.recipient, {
    status: 201,
    message: "Created",
    session,
  });
}
