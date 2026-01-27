import { NextResponse } from "next/server"

export const config = {
  matcher: ["/api/:path*"],
  runtime: "nodejs",
}

export function middleware() {
  return NextResponse.next()
}
