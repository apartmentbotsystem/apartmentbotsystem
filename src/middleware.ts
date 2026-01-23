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
  let session = null
  try {
    session = await auth(req)
  } catch {
    const url = req.nextUrl.clone()
    url.pathname = "/login"
    const res = NextResponse.redirect(url)
    res.cookies.set("app_session", "", { maxAge: 0, path: "/" })
    return res
  }
  if (!session) {
    if (isApi(pathname)) {
      const res = NextResponse.json({ code: ErrorCodes.UNAUTHORIZED, message: "Unauthorized" }, { status: ErrorStatus.UNAUTHORIZED })
      res.cookies.set("app_session", "", { maxAge: 0, path: "/" })
      return res
    }
    const url = req.nextUrl.clone()
    url.pathname = "/login"
    const res = NextResponse.redirect(url)
    res.cookies.set("app_session", "", { maxAge: 0, path: "/" })
    return res
  }
  const role = session.role
  if (pathname.startsWith("/admin/")) {
    if (role !== "ADMIN") {
      const res = NextResponse.json({ code: ErrorCodes.FORBIDDEN, message: "Forbidden" }, { status: ErrorStatus.FORBIDDEN })
      res.cookies.set("app_session", "", { maxAge: 0, path: "/" })
      return res
    }
  } else if (pathname.startsWith("/staff/")) {
    if (role !== "ADMIN" && role !== "STAFF") {
      const res = NextResponse.json({ code: ErrorCodes.FORBIDDEN, message: "Forbidden" }, { status: ErrorStatus.FORBIDDEN })
      res.cookies.set("app_session", "", { maxAge: 0, path: "/" })
      return res
    }
  } else if (pathname.startsWith("/api/admin/")) {
    if (role !== "ADMIN") {
      const res = NextResponse.json({ code: ErrorCodes.FORBIDDEN, message: "Forbidden" }, { status: ErrorStatus.FORBIDDEN })
      res.cookies.set("app_session", "", { maxAge: 0, path: "/" })
      return res
    }
  } else if (pathname.startsWith("/api/staff/")) {
    if (role !== "ADMIN" && role !== "STAFF") {
      const res = NextResponse.json({ code: ErrorCodes.FORBIDDEN, message: "Forbidden" }, { status: ErrorStatus.FORBIDDEN })
      res.cookies.set("app_session", "", { maxAge: 0, path: "/" })
      return res
    }
  }
  return NextResponse.next()
}

export const config = {
  matcher: ["/admin/:path*", "/staff/:path*", "/api/admin/:path*", "/api/staff/:path*", "/login"],
}
