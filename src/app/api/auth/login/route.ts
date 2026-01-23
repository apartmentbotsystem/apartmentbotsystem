import { withErrorHandling } from "@/interface/http/withErrorHandling"
import { respondOk } from "@/interface/http/response"
import { ValidationError } from "@/interface/errors/ValidationError"
import { httpError } from "@/interface/errors/HttpError"
import { ErrorCodes } from "@/interface/errors/error-codes"
import { signSession, SESSION_MAX_AGE } from "@/lib/auth.config"
import { emitAuditEvent } from "@/infrastructure/audit/audit.service"

export const runtime = "nodejs"

function serializeCookie(name: string, value: string, opts: { maxAge?: number; path?: string; secure?: boolean; httpOnly?: boolean; sameSite?: "lax" | "strict" | "none"; expires?: Date }) {
  const parts = [`${name}=${encodeURIComponent(value)}`]
  if (opts.maxAge !== undefined) parts.push(`Max-Age=${opts.maxAge}`)
  if (opts.expires) parts.push(`Expires=${opts.expires.toUTCString()}`)
  parts.push(`Path=${opts.path ?? "/"}`)
  if (opts.secure) parts.push("Secure")
  if (opts.httpOnly) parts.push("HttpOnly")
  const ss = opts.sameSite ?? "lax"
  parts.push(`SameSite=${ss.charAt(0).toUpperCase() + ss.slice(1)}`)
  return parts.join("; ")
}

export const POST = withErrorHandling(async (req: Request): Promise<Response> => {
  const contentType = req.headers.get("content-type") || ""
  if (!contentType.includes("application/json")) {
    throw new ValidationError("Invalid content-type")
  }
  const body = await req.json().catch(() => null)
  const email = body?.email
  const password = body?.password
  if (!email || typeof email !== "string" || !password || typeof password !== "string") {
    throw new ValidationError("Invalid credentials")
  }

  const baseUrl = process.env.BACKEND_API_URL
  if (!baseUrl) {
    throw httpError(ErrorCodes.INTERNAL_ERROR, "Auth backend not configured")
  }

  const resp = await fetch(`${baseUrl.replace(/\/+$/, "")}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  })

  if (!resp.ok) {
    emitAuditEvent({
      actorType: "SYSTEM",
      action: "LOGIN_FAILED",
      targetType: "AUTH",
      severity: "WARN",
      metadata: { email },
    })
    throw httpError(ErrorCodes.UNAUTHORIZED, "Invalid login")
  }

  let userId: string | undefined
  let role: "ADMIN" | "STAFF" | undefined
  const json = await resp.json().catch(() => null)
  if (json && typeof json === "object") {
    if (json.success && json.data && typeof json.data.userId === "string" && typeof json.data.role === "string") {
      userId = json.data.userId
      role = json.data.role
    } else if (typeof json.userId === "string" && typeof json.role === "string") {
      userId = json.userId
      role = json.role
    }
  }
  if (!userId || !role || (role !== "ADMIN" && role !== "STAFF")) {
    throw httpError(ErrorCodes.VALIDATION_ERROR, "Invalid auth response")
  }

  const isSecure = (() => {
    try {
      const u = new URL(req.url)
      return u.protocol === "https:"
    } catch {
      return process.env.NODE_ENV === "production"
    }
  })()
  const sessionValue = await signSession({ userId, role, iat: Math.floor(Date.now() / 1000), sessionVersion: 1 })
  const cookieSession = serializeCookie("app_session", sessionValue, {
    maxAge: SESSION_MAX_AGE,
    path: "/",
    secure: isSecure,
    httpOnly: true,
    sameSite: "lax",
  })

  emitAuditEvent({
    actorType: role,
    actorId: userId,
    action: "LOGIN_SUCCESS",
    targetType: "AUTH",
    targetId: userId,
    severity: "INFO",
    metadata: { email },
  })

  const res = respondOk(req, { userId, role }, 200)
  res.headers.append("Set-Cookie", cookieSession)
  return res
})
