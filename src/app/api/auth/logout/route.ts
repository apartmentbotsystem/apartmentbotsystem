import { withErrorHandling } from "@/interface/http/withErrorHandling"
import { respondOk } from "@/interface/http/response"

export const runtime = "nodejs"

function serializeCookie(name: string, value: string, opts: { path?: string; secure?: boolean; httpOnly?: boolean; sameSite?: "lax" | "strict" | "none"; expires?: Date }) {
  const parts = [`${name}=${encodeURIComponent(value)}`]
  parts.push(`Path=${opts.path ?? "/"}`)
  if (opts.expires) parts.push(`Expires=${opts.expires.toUTCString()}`)
  if (opts.secure) parts.push("Secure")
  if (opts.httpOnly) parts.push("HttpOnly")
  const ss = opts.sameSite ?? "lax"
  parts.push(`SameSite=${ss.charAt(0).toUpperCase() + ss.slice(1)}`)
  return parts.join("; ")
}

export const POST = withErrorHandling(async (req: Request): Promise<Response> => {
  const past = new Date(0)
  const isSecure = (() => {
    try {
      const u = new URL(req.url)
      return u.protocol === "https:"
    } catch {
      return process.env.NODE_ENV === "production"
    }
  })()
  const cookieSession = serializeCookie("app_session", "", { path: "/", secure: isSecure, httpOnly: true, sameSite: "lax", expires: past })
  const res = respondOk(req, { ok: true }, 200)
  res.headers.append("Set-Cookie", cookieSession)
  return res
})
