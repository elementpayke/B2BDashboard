import { NextRequest, NextResponse } from "next/server";
import { proxyRequest } from "@/lib/server/mbokaProxy";
import { mbokaProxyTarget } from "@/lib/server/mbokaProxyAllowlist";

function backendPathWithQuery(request: NextRequest, path: string[]): string | null {
  return mbokaProxyTarget(path, request.nextUrl.search);
}

async function handle(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
): Promise<NextResponse> {
  const { path } = await params;
  const target = backendPathWithQuery(request, path);
  if (!target) {
    return NextResponse.json(
      { status: "error", message: "Not found", data: null },
      { status: 404 },
    );
  }
  return proxyRequest(request, target);
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
