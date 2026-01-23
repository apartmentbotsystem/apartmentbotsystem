import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth.config"
import { ErrorCodes, ErrorStatus } from "@/interface/errors/error-codes"

function isApi(pathname: string): boolean {
  return pathname.startsWith("/api/")
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  if (pathname === "/login") return NextResponse.next()
  const session = await auth(req)
  if (!session) {
    if (isApi(pathname)) {
      return NextResponse.json({ code: ErrorCodes.UNAUTHORIZED, message: "Unauthorized" }, { status: ErrorStatus.UNAUTHORIZED })
    }
    const url = req.nextUrl.clone()
    url.pathname = "/login"
    return NextResponse.redirect(url)
  }
  const role = session.role
  if (pathname.startsWith("/admin/")) {
    if (role !== "ADMIN") {
      return NextResponse.json({ code: ErrorCodes.FORBIDDEN, message: "Forbidden" }, { status: ErrorStatus.FORBIDDEN })
    }
  } else if (pathname.startsWith("/staff/")) {
    if (role !== "ADMIN" && role !== "STAFF") {
      return NextResponse.json({ code: ErrorCodes.FORBIDDEN, message: "Forbidden" }, { status: ErrorStatus.FORBIDDEN })
    }
  } else if (pathname.startsWith("/api/admin/")) {
    if (role !== "ADMIN") {
      return NextResponse.json({ code: ErrorCodes.FORBIDDEN, message: "Forbidden" }, { status: ErrorStatus.FORBIDDEN })
    }
  } else if (pathname.startsWith("/api/staff/")) {
    if (role !== "ADMIN" && role !== "STAFF") {
      return NextResponse.json({ code: ErrorCodes.FORBIDDEN, message: "Forbidden" }, { status: ErrorStatus.FORBIDDEN })
    }
  }
  return NextResponse.next()
}

export const config = {
  matcher: ["/admin/:path*", "/staff/:path*", "/api/admin/:path*", "/api/staff/:path*", "/login"],
}
