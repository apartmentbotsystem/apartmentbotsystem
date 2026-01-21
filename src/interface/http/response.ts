function acceptsEnvelope(req: Request): boolean {
  const accept = req.headers.get("accept") || ""
  return accept.split(",").some((t) => t.trim().toLowerCase() === "application/vnd.apartment.v1.1+json")
}

export function respondOk(req: Request, data: unknown, status = 200): Response {
  if (acceptsEnvelope(req)) {
    return new Response(JSON.stringify({ success: true, data }), { status, headers: { "Content-Type": "application/json" } })
  }
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } })
}

export function respondError(req: Request, code: string, message: string, status: number): Response {
  if (acceptsEnvelope(req)) {
    return new Response(JSON.stringify({ success: false, error: { code, message } }), { status, headers: { "Content-Type": "application/json" } })
  }
  return new Response(JSON.stringify({ code, message }), { status, headers: { "Content-Type": "application/json" } })
}

