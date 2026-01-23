export type Role = "ADMIN" | "STAFF"

export type SessionClaims = {
  userId?: string
  role?: Role
  iat?: number
  sessionVersion?: number
}

function parseCookies(header: string | null): Record<string, string> {
  const out: Record<string, string> = {}
  if (!header) return out
  const parts = header.split(";")
  for (const p of parts) {
    const idx = p.indexOf("=")
    if (idx === -1) continue
    const k = p.slice(0, idx).trim()
    const v = p.slice(idx + 1).trim()
    out[k] = v
  }
  return out
}

function getSecret(): string | null {
  const s = process.env.SESSION_SECRET || process.env.NEXTAUTH_SECRET || ""
  if (!s && process.env.NODE_ENV === "production") return null
  return s || "dev-session-secret"
}

export const SESSION_MAX_AGE = 60 * 60 * 24 * 7

async function hmac(key: string, data: string): Promise<string> {
  const enc = new TextEncoder()
  const cryptoKey = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(data))
  const bytes = new Uint8Array(sig)
  let hex = ""
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, "0")
  }
  return hex
}

function encodePayload(payload: Record<string, unknown>): string {
  const s = JSON.stringify(payload)
  return encodeURIComponent(s)
}

function decodePayload(s: string): Record<string, unknown> | null {
  try {
    const json = decodeURIComponent(s)
    const obj = JSON.parse(json)
    return obj && typeof obj === "object" ? obj : null
  } catch {
    return null
  }
}

export async function signSession(payload: { userId: string; role: Role; iat: number; sessionVersion: number }): Promise<string> {
  const secret = getSecret()
  if (!secret) throw new Error("SESSION_SECRET missing")
  const enc = encodePayload(payload)
  const sig = await hmac(secret, enc)
  return `v1.${enc}.${sig}`
}

import { httpError } from "@/interface/errors/HttpError"
import { ErrorCodes } from "@/interface/errors/error-codes"

export async function verifySession(value: string | undefined): Promise<SessionClaims | null> {
  if (!value) return null
  if (!value.startsWith("v1.")) return null
  const secret = getSecret()
  if (!secret) return null
  const parts = value.split(".")
  if (parts.length !== 3) return null
  const enc = parts[1]
  const sig = parts[2]
  const calc = await hmac(secret, enc)
  if (calc !== sig) return null
  const obj = decodePayload(enc)
  if (!obj) return null
  const userId = typeof obj["userId"] === "string" ? (obj["userId"] as string) : undefined
  const role = obj["role"] === "ADMIN" || obj["role"] === "STAFF" ? (obj["role"] as Role) : undefined
  const iat = typeof obj["iat"] === "number" ? (obj["iat"] as number) : undefined
  const sessionVersion = typeof obj["sessionVersion"] === "number" ? (obj["sessionVersion"] as number) : undefined
  if (!userId || !role || !iat) return null
  const now = Math.floor(Date.now() / 1000)
  if (now - iat > SESSION_MAX_AGE) {
    throw httpError(ErrorCodes.UNAUTHORIZED, "Session expired")
  }
  // TODO(F5): compare payload.sessionVersion with server currentSessionVersion
  return { userId, role, iat, sessionVersion }
}

export async function auth(req?: Request): Promise<SessionClaims | null> {
  if (!req) return null
  const cookies = parseCookies(req.headers.get("cookie"))
  const sessionCookie = cookies["app_session"]
  return verifySession(sessionCookie)
}
