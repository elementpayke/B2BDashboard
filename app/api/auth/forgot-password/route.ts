import { NextRequest, NextResponse } from "next/server";
import { callMboka, passthroughJson } from "@/lib/server/mbokaCall";
import { verifyTurnstileToken } from "@/lib/server/turnstile";

function isTimeoutError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "name" in err &&
    ((err as { name: string }).name === "TimeoutError" ||
      (err as { name: string }).name === "AbortError")
  );
}

export async function POST(request: NextRequest): Promise<Response> {
  let parsed: { email?: string; turnstileToken?: string };
  try {
    parsed = (await request.json()) as { email?: string; turnstileToken?: string };
  } catch {
    return NextResponse.json(
      { status: "error", message: "Invalid JSON body", data: null },
      { status: 400 },
    );
  }

  const remoteip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const turnstileOk = await verifyTurnstileToken(parsed.turnstileToken, remoteip);
  if (!turnstileOk) {
    return NextResponse.json(
      { status: "error", message: "Verification failed. Please try again.", data: null },
      { status: 400 },
    );
  }

  const body = JSON.stringify({ email: parsed.email });
  try {
    const upstream = await callMboka("/api/auth/password/forgot", { method: "POST", body });
    return passthroughJson(upstream);
  } catch (err) {
    const timedOut = isTimeoutError(err);
    return NextResponse.json(
      {
        status: "error",
        message: timedOut
          ? "The request took too long. Please try again."
          : "Unable to request a password reset.",
        data: null,
      },
      { status: timedOut ? 504 : 502 },
    );
  }
}
