import { randomUUID } from "crypto"

export type RequestMeta = {
  requestId: string
  method: string
  path: string
  ip?: string
  userId?: string
  role?: string
}

export function buildRequestMeta(req: Request): RequestMeta {
  const incomingId = req.headers.get("x-request-id")
  const requestId = incomingId && incomingId.length > 0 ? incomingId : randomUUID()
  const url = new URL(req.url)
  const auth = getAuthContext(req)
  return {
    requestId,
    method: req.method || "GET",
    path: url.pathname,
    ip: getClientIp(req),
    userId: auth.userId,
    role: auth.role,
  }
}

export function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for")
  if (xff) {
    const first = xff.split(",")[0]?.trim()
    if (first) return first
  }
  const xri = req.headers.get("x-real-ip")
  if (xri) return xri
  return "unknown"
}

function base64UrlToJson(s: string): unknown {
  let b64 = s.replace(/-/g, "+").replace(/_/g, "/")
  const pad = b64.length % 4
  if (pad === 2) b64 += "=="
  else if (pad === 3) b64 += "="
  const buf = Buffer.from(b64, "base64").toString("utf-8")
  try {
    return JSON.parse(buf)
  } catch {
    return null
  }
}

function tryParseJwt(token: string): { userId?: string; role?: string } {
  const parts = token.split(".")
  if (parts.length !== 3) return {}
  const payload = base64UrlToJson(parts[1]) as Record<string, unknown> | null
  if (!payload || typeof payload !== "object") return {}
  const sub = typeof payload.sub === "string" ? payload.sub : undefined
  const userId = typeof payload.userId === "string" ? payload.userId : sub
  const role = typeof payload.role === "string" ? payload.role : undefined
  return { userId, role }
}

function parseCookies(header: string | null): Record<string, string> {
  const result: Record<string, string> = {}
  if (!header) return result
  const pairs = header.split(";")
  for (const p of pairs) {
    const idx = p.indexOf("=")
    if (idx > -1) {
      const k = p.slice(0, idx).trim()
      const v = p.slice(idx + 1).trim()
      result[k] = v
    }
  }
  return result
}

function getAuthContext(req: Request): { userId?: string; role?: string } {
  const hdrUserId = req.headers.get("x-user-id") || undefined
  const hdrRole = req.headers.get("x-user-role") || undefined
  if (hdrUserId || hdrRole) return { userId: hdrUserId || undefined, role: hdrRole || undefined }
  const auth = req.headers.get("authorization")
  if (auth && auth.startsWith("Bearer ")) {
    const token = auth.slice("Bearer ".length).trim()
    const parsed = tryParseJwt(token)
    if (parsed.userId || parsed.role) return parsed
  }
  const cookies = parseCookies(req.headers.get("cookie"))
  const jwtCookie = cookies["auth_token"] || cookies["next-auth.session-token"] || undefined
  if (jwtCookie) {
    const parsed = tryParseJwt(jwtCookie)
    if (parsed.userId || parsed.role) return parsed
  }
  const cookieUserId = cookies["userId"] || undefined
  const cookieRole = cookies["role"] || undefined
  if (cookieUserId || cookieRole) return { userId: cookieUserId, role: cookieRole }
  return {}
}
