import { NextRequest } from "next/server";
import { callMboka, passthroughJson } from "@/lib/server/mbokaCall";
import { rejectCrossOrigin } from "@/lib/server/sameOrigin";

export async function POST(request: NextRequest): Promise<Response> {
  const blocked = rejectCrossOrigin(request);
  if (blocked) return blocked;
  const body = await request.text();
  const upstream = await callMboka("/api/auth/resend-verification", {
    method: "POST",
    body,
  });
  // Soften enumeration: always return a generic success envelope to the client
  // when upstream used a distinct not-found message. Preserve real rate-limit /
  // validation failures (4xx other than 404).
  if (upstream.status === 404) {
    return Response.json(
      {
        status: "success",
        message: "If an account exists for that email, a verification code was sent.",
        data: { ok: true },
      },
      { status: 200 },
    );
  }
  return passthroughJson(upstream);
}
