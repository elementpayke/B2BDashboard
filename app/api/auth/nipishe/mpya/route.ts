import { NextRequest, NextResponse } from "next/server";
import { callMboka, passthroughJson } from "@/lib/server/mbokaCall";
import { rejectCrossOrigin } from "@/lib/server/sameOrigin";
import { verifyTurnstileToken } from "@/lib/server/turnstile";

/**
 * Unlisted signup proxy — paired with app/nipishe/mpya/page.tsx. Public
 * signup is still launch-gated at /api/auth/signup (403); this path exists
 * for direct, out-of-band invites only. Forwards to Mboka-Backend's
 * /api/auth/nipishe/mpya (app/routes/auth.py) — keep both names in sync.
 */
export async function POST(request: NextRequest): Promise<Response> {
  const blocked = rejectCrossOrigin(request);
  if (blocked) return blocked;

  const { turnstileToken, ...credentials } = (await request.json()) as {
    turnstileToken?: string;
    [key: string]: unknown;
  };

  const remoteip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const turnstileOk = await verifyTurnstileToken(turnstileToken, remoteip);
  if (!turnstileOk) {
    return NextResponse.json(
      { status: "error", message: "Verification failed. Please try again.", data: null },
      { status: 400 },
    );
  }

  const upstream = await callMboka("/api/auth/nipishe/mpya", {
    method: "POST",
    body: JSON.stringify(credentials),
  });
  return passthroughJson(upstream);
}
