import { NextRequest, NextResponse } from "next/server";
import { callMboka } from "@/lib/server/mbokaCall";
import { setSessionCookies } from "@/lib/server/cookies";

type LoginBusinessData = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  kyb_status: string | null;
  role: string | null;
  user_id: number;
  business_id: number | null;
  wallet_address: string | null;
};

type Envelope = {
  status: "success" | "error";
  message: string;
  data: LoginBusinessData | null;
};

export async function POST(request: NextRequest): Promise<NextResponse> {
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
    // Passthrough verbatim — no tokens are present on an error response,
    // and we deliberately don't alter the message so the backend's
    // wrong-password vs unknown-email indistinguishability is preserved.
    return NextResponse.json(json, { status: upstream.status });
  }

  const { access_token, refresh_token, ...rest } = json.data;
  const safeData = rest; // token_type, kyb_status, role, user_id, business_id, wallet_address — never the tokens

  const res = NextResponse.json(
    { status: json.status, message: json.message, data: safeData },
    { status: upstream.status },
  );
  setSessionCookies(res, { access_token, refresh_token });
  return res;
}
