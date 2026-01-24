import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth.config"

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl
  if (!pathname.startsWith("/dashboard")) {
    return NextResponse.next()
  }
  let session = null
  try {
    session = await auth(req)
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
