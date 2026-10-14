import { NextRequest } from "next/server";
import {
  jsonError,
  jsonSuccess,
  requireSessionBusiness,
} from "@/lib/server/session";
import { rejectCrossOrigin } from "@/lib/server/sameOrigin";
import { getCardColors, setCardColor } from "@/lib/server/cardColorsStore";
import { isCardColorKey } from "@/lib/services/cardColors";

/** Card ids are partner ids — opaque, but never long or exotic. */
const CARD_ID_RE = /^[A-Za-z0-9_.:-]{1,128}$/;

export async function GET(request: NextRequest) {
  const session = await requireSessionBusiness(request);
  if (session instanceof Response) return session;

  const colors = await getCardColors(session.businessId);
  return jsonSuccess({ colors }, { message: "ok", session });
}

export async function PUT(request: NextRequest) {
  const blocked = rejectCrossOrigin(request);
  if (blocked) return blocked;
  const session = await requireSessionBusiness(request);
  if (session instanceof Response) return session;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid JSON body", session);
  }
  const { cardId, color } = (body ?? {}) as { cardId?: unknown; color?: unknown };
  if (typeof cardId !== "string" || !CARD_ID_RE.test(cardId)) {
    return jsonError(400, "cardId is invalid", session);
  }
  if (!isCardColorKey(color)) {
    return jsonError(400, "color is not a palette key", session);
  }

  const saved = await setCardColor(session.businessId, cardId, color);
  if (saved.ok === false) {
    return jsonError(saved.status, saved.message, session);
  }
  return jsonSuccess({ colors: saved.colors }, { message: "Saved", session });
}
