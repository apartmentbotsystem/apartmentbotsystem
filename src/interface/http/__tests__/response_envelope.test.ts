import { describe, it, expect } from "vitest"
import { withErrorHandling } from "@/interface/http/withErrorHandling"
import { respondOk } from "@/interface/http/response"
import { ValidationError } from "@/interface/errors/ValidationError"
import { HttpError } from "@/interface/errors/HttpError"

function makeReq(url: string, init?: RequestInit, headers?: Record<string, string>) {
  const h = new Headers(init?.headers || {})
  if (headers) for (const [k, v] of Object.entries(headers)) h.set(k, v)
  return new Request(url, { ...init, headers: h })
}

describe("Response envelope opt-in", () => {
  it("legacy success: byte-identical when no Accept header", async () => {
    const data = { hello: "world" }
    const handler = withErrorHandling(async (req: Request) => respondOk(req, data, 200))
    const res = await handler(makeReq("http://localhost/api/test", { method: "GET" }))
    const text = await res.text()
    expect(text).toBe(JSON.stringify(data))
  })

  it("envelope success: wraps when Accept vnd provided", async () => {
    const data = { hello: "world" }
    const handler = withErrorHandling(async (req: Request) => respondOk(req, data, 200))
    const res = await handler(makeReq("http://localhost/api/test", { method: "GET" }, { accept: "application/vnd.apartment.v1.1+json" }))
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data).toEqual(data)
  })

  it("legacy error: ValidationError payload unchanged without Accept", async () => {
    const handler = withErrorHandling(async () => {
      throw new ValidationError("Invalid input")
    })
    const res = await handler(makeReq("http://localhost/api/test", { method: "POST" }))
    expect(res.status).toBe(400)
    const text = await res.text()
    expect(text).toBe(JSON.stringify({ code: "VALIDATION_ERROR", message: "Invalid input" }))
  })

  it("envelope error: wraps ValidationError when Accept vnd provided", async () => {
    const handler = withErrorHandling(async () => {
      throw new ValidationError("Invalid input")
    })
    const res = await handler(makeReq("http://localhost/api/test", { method: "POST" }, { accept: "application/vnd.apartment.v1.1+json" }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.error).toEqual({ code: "VALIDATION_ERROR", message: "Invalid input" })
  })

  it("error mapping: HttpError passes through code/message with unchanged status", async () => {
    const handler = withErrorHandling(async () => {
      throw new HttpError(409, "INVOICE_ALREADY_EXISTS", "Invoice already exists")
    })
    const resLegacy = await handler(makeReq("http://localhost/api/invoices", { method: "POST" }))
    expect(resLegacy.status).toBe(409)
    const text = await resLegacy.text()
    expect(text).toBe(JSON.stringify({ code: "INVOICE_ALREADY_EXISTS", message: "Invoice already exists" }))
    const resEnvelope = await handler(makeReq("http://localhost/api/invoices", { method: "POST" }, { accept: "application/vnd.apartment.v1.1+json" }))
    expect(resEnvelope.status).toBe(409)
    const json = await resEnvelope.json()
    expect(json.success).toBe(false)
    expect(json.error).toEqual({ code: "INVOICE_ALREADY_EXISTS", message: "Invoice already exists" })
  })
})

