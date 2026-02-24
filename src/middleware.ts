import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

import { buildCorsHeaders } from "@/lib/cors";

export function middleware(req: NextRequest): NextResponse {
  const requestId = req.headers.get("x-request-id")?.trim() || randomUUID();
  const corsHeaders = buildCorsHeaders(req);

  if (req.method === "OPTIONS") {
    const optionsRes = new NextResponse(null, {
      status: 204,
      headers: corsHeaders,
    });
    optionsRes.headers.set("x-request-id", requestId);
    return optionsRes;
  }

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-request-id", requestId);
  const res = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
  corsHeaders.forEach((value, key) => {
    res.headers.set(key, value);
  });
  res.headers.set("x-request-id", requestId);

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
