import { randomUUID } from "crypto"

export type RequestMeta = {
  requestId: string
  method: string
  path: string
  ip?: string
}

export function buildRequestMeta(req: Request): RequestMeta {
  const incomingId = req.headers.get("x-request-id")
  const requestId = incomingId && incomingId.length > 0 ? incomingId : randomUUID()
  const url = new URL(req.url)
  return {
    requestId,
    method: req.method || "GET",
    path: url.pathname,
    ip: getClientIp(req),
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
