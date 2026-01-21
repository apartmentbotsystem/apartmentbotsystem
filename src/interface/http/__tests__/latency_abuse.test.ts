import { describe, it, expect, vi } from "vitest"
import { withErrorHandling } from "@/interface/http/withErrorHandling"
import { logger } from "@/interface/logger/logger"
import { ValidationError } from "@/interface/errors/ValidationError"

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function makeRequest(url = "http://localhost/api/test", headers?: Record<string, string>) {
  return new Request(url, {
    method: "POST",
    headers,
  })
}

describe("Latency tracking", () => {
  it("sets x-response-time and logs latency", async () => {
    const spy = vi.spyOn(logger, "info")
    const handler = withErrorHandling(async () => {
      await sleep(15)
      return Response.json({ ok: true }, { status: 200 })
    })
    const req = makeRequest()
    const res = await handler(req, undefined)
    const rt = res.headers.get("x-response-time")
    expect(rt).toBeTruthy()
    const rtNum = Number(rt)
    expect(rtNum).toBeGreaterThanOrEqual(10)
    expect(spy).toHaveBeenCalled()
    const call = spy.mock.calls[0][0]
    expect(call.latencyMs).toBeGreaterThanOrEqual(10)
  })
})

describe("Abuse signals (soft)", () => {
  it("logs warn for too large body (content-length)", async () => {
    const warnSpy = vi.spyOn(logger, "warn")
    const handler = withErrorHandling(async () => {
      return Response.json({ ok: true }, { status: 200 })
    })
    const req = makeRequest("http://localhost/api/test", { "content-length": "2000000" })
    const res = await handler(req, undefined)
    expect(res.status).toBe(200)
    expect(warnSpy).toHaveBeenCalled()
  })

  it("logs warn for burst invalid payloads but keeps responses normal", async () => {
    const warnSpy = vi.spyOn(logger, "warn")
    const handler = withErrorHandling(async () => {
      throw new ValidationError("Invalid input")
    })
    for (let i = 0; i < 12; i++) {
      const req = makeRequest("http://localhost/api/test", { "x-forwarded-for": "1.2.3.4" })
      const res = await handler(req, undefined)
      expect(res.status).toBe(400)
    }
    expect(warnSpy).toHaveBeenCalled()
  })
})

