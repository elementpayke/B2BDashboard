import { NextRequest } from "next/server";
import { callMboka, passthroughJson } from "@/lib/server/mbokaCall";

export async function POST(request: NextRequest): Promise<Response> {
  const body = await request.text();
  const upstream = await callMboka("/api/auth/resend-verification", {
    method: "POST",
    body,
  });
  return passthroughJson(upstream);
}
