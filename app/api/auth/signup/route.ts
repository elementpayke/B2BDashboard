import { NextRequest } from "next/server";
import { callMboka, passthroughJson } from "@/lib/server/mbokaCall";
import { rejectCrossOrigin } from "@/lib/server/sameOrigin";

export async function POST(request: NextRequest): Promise<Response> {
  const blocked = rejectCrossOrigin(request);
  if (blocked) return blocked;
  const body = await request.text();
  const upstream = await callMboka("/api/auth/businesses/signup", {
    method: "POST",
    body,
  });
  return passthroughJson(upstream);
}
