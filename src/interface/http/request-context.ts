import { randomUUID } from "crypto"

export type RequestMeta = {
  requestId: string
  method: string
  path: string
}

export function buildRequestMeta(req: Request): RequestMeta {
  const incomingId = req.headers.get("x-request-id")
  const requestId = incomingId && incomingId.length > 0 ? incomingId : randomUUID()
  const url = new URL(req.url)
  return {
    requestId,
    method: req.method || "GET",
    path: url.pathname,
  }
}

