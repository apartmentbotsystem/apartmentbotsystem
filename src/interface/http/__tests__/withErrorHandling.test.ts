import { describe, it, expect, vi } from "vitest"
import { withErrorHandling } from "@/interface/http/withErrorHandling"
import { logger } from "@/interface/logger/logger"
import { ValidationError } from "@/interface/errors/ValidationError"

function makeRequest(url = "http://localhost/api/test", headers?: Record<string, string>) {
  return new Request(url, {
    method: "POST",
    headers,
  })
}

describe("withErrorHandling - requestId correlation", () => {
  it("generates requestId when header missing and returns it in response header", async () => {
    const handler = withErrorHandling(async () => {
      return Response.json({ ok: true }, { status: 201 })
    })
    const req = makeRequest()
    const res = await handler(req, undefined)
    const rid = res.headers.get("x-request-id")
    expect(rid).toBeTruthy()
    expect(rid?.length).toBeGreaterThan(0)
  })

  it("uses provided x-request-id from client", async () => {
    const handler = withErrorHandling(async () => {
      return Response.json({ ok: true }, { status: 200 })
    })
    const req = makeRequest("http://localhost/api/test", { "x-request-id": "req-abc123" })
    const res = await handler(req, undefined)
    const rid = res.headers.get("x-request-id")
    expect(rid).toBe("req-abc123")
  })
})

describe("withErrorHandling - error logging integration", () => {
  it("logs error with ValidationError code", async () => {
    const spy = vi.spyOn(logger, "error")
    const handler = withErrorHandling(async () => {
      throw new ValidationError("Invalid input")
    })
    const req = makeRequest()
    const res = await handler(req, undefined)
    expect(res.status).toBe(400)
    expect(spy).toHaveBeenCalled()
    const call = spy.mock.calls[0][0]
    expect(call.errorCode).toBe("VALIDATION_ERROR")
    expect(call.requestId).toBeTruthy()
  })
})

