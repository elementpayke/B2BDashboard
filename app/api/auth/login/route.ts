import { NextRequest, NextResponse } from "next/server";
import { callMboka } from "@/lib/server/mbokaCall";
import { setSessionCookies } from "@/lib/server/cookies";
import { rejectCrossOrigin } from "@/lib/server/sameOrigin";

type LoginBusinessData = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  kyb_status: string | null;
  role: string | null;
  user_id: number;
  business_id: number | null;
  wallet_address: string | null;
  business_name?: string | null;
  permissions?: string[];
};

type Envelope = {
  status: "success" | "error";
  message: string;
  data: LoginBusinessData | null;
};

export async function POST(request: NextRequest): Promise<NextResponse> {
  const blocked = rejectCrossOrigin(request);
  if (blocked) return blocked as NextResponse;

  const body = await request.text();
  const upstream = await callMboka("/api/auth/businesses/login", {
    method: "POST",
    body,
  });

  let json: Envelope;
  try {
    json = (await upstream.json()) as Envelope;
  } catch {
    return NextResponse.json(
      { status: "error", message: `Upstream returned ${upstream.status}`, data: null },
      { status: upstream.status || 502 },
    );
  }

  if (!upstream.ok || json.status !== "success" || !json.data) {
    return NextResponse.json(json, { status: upstream.status });
  }

  const { access_token, refresh_token, ...rest } = json.data;

  const res = NextResponse.json(
    { status: json.status, message: json.message, data: rest },
    { status: upstream.status },
  );
  setSessionCookies(res, { access_token, refresh_token });
  return res;
}
