import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { verifySession } from "./lib/auth.config"

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl
  if (!pathname.startsWith("/dashboard")) {
    return NextResponse.next()
  }
  let session = null
  try {
    const cookie = req.cookies.get("app_session")?.value
    session = await verifySession(cookie)
  } catch {
    const url = req.nextUrl.clone()
    url.pathname = "/login"
    return NextResponse.redirect(url)
  }
  if (!session || session.role !== "ADMIN") {
    const url = req.nextUrl.clone()
    url.pathname = "/login"
    return NextResponse.redirect(url)
  }
  return NextResponse.next()
}

export const config = {
  matcher: ["/dashboard/:path*"],
}
