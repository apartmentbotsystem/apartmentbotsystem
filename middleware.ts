import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { verifySession } from "./src/lib/auth.config"

function isProtectedPath(pathname: string): boolean {
  const protectedPrefixes = ["/dashboard", "/invoices", "/payments", "/tenants", "/activity", "/admin"]
  for (const p of protectedPrefixes) {
    if (pathname === p || pathname.startsWith(`${p}/`)) return true
  }
  return false
}

function isProtectedApi(pathname: string): boolean {
  const apiPrefixes = ["/api/admin"]
  for (const p of apiPrefixes) {
    if (pathname === p || pathname.startsWith(`${p}/`)) return true
  }
  return false
}

function isBypassed(pathname: string): boolean {
  if (pathname === "/login" || pathname.startsWith("/login")) return true
  if (pathname.startsWith("/_next")) return true
  if (pathname.startsWith("/public")) return true
  if (pathname.startsWith("/api/line")) return true
  if (pathname.startsWith("/api/auth")) return true
  return false
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  if (isBypassed(pathname)) {
    return NextResponse.next()
  }
  const needGuard = isProtectedPath(pathname) || isProtectedApi(pathname)
  if (!needGuard) {
    return NextResponse.next()
  }
  try {
    const cookie = req.cookies.get("app_session")?.value
    const session = await verifySession(cookie)
    if (!session) {
      const url = req.nextUrl.clone()
      url.pathname = "/login"
      return NextResponse.redirect(url)
    }
    if (session.role === "ADMIN") {
      return NextResponse.next()
    }
    if (session.role === "STAFF") {
      if (pathname.startsWith("/admin")) {
        const url = req.nextUrl.clone()
        url.pathname = "/dashboard"
        return NextResponse.redirect(url)
      }
      return NextResponse.next()
    }
    return NextResponse.next()
  } catch {
    const url = req.nextUrl.clone()
    url.pathname = "/login"
    return NextResponse.redirect(url)
  }
}

export const config = {
  matcher: ["/((?!api/line).*)"],
}
