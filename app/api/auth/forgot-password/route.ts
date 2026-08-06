import { NextRequest, NextResponse } from "next/server";
import { callMboka, passthroughJson } from "@/lib/server/mbokaCall";

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
  const body = await request.text();
  try {
    const upstream = await callMboka("/api/auth/password/forgot", { method: "POST", body });
    return passthroughJson(upstream);
  } catch (err) {
    // callMboka uses AbortSignal.timeout — surface a JSON envelope the client can show.
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
