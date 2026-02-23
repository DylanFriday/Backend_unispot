import { NextRequest, NextResponse } from "next/server";

import { buildCorsHeaders } from "@/lib/cors";

export function middleware(req: NextRequest): NextResponse {
  const corsHeaders = buildCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new NextResponse(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  const res = NextResponse.next();
  corsHeaders.forEach((value, key) => {
    res.headers.set(key, value);
  });

  return res;
}

export const config = {
  matcher: "/api/:path*",
};
