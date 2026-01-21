import { describe, it, expect } from "vitest"
import { withErrorHandling } from "@/interface/http/withErrorHandling"

function makeReq(url: string, init?: RequestInit, headers?: Record<string, string>) {
  const h = new Headers(init?.headers || {})
  if (headers) for (const [k, v] of Object.entries(headers)) h.set(k, v)
  return new Request(url, { ...init, headers: h })
}

describe("Rate limiting", () => {
  it("allows under limit", async () => {
    const handler = withErrorHandling(async () => new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } }))
    for (let i = 0; i < 5; i++) {
      const res = await handler(makeReq("http://localhost/api/test", { method: "GET" }, { "x-real-ip": "1.1.1.1" }))
      expect(res.status).toBe(200)
    }
  })

  it("blocks when exceeded", async () => {
    const handler = withErrorHandling(async () => new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } }))
    let blocked = 0
    for (let i = 0; i < 70; i++) {
      const res = await handler(makeReq("http://localhost/api/write", { method: "POST" }, { "x-real-ip": "2.2.2.2" }))
      if (res.status === 429) blocked++
    }
    expect(blocked).toBeGreaterThan(0)
  })

  it("uses user-based limit when userId present", async () => {
    const handler = withErrorHandling(async () => new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } }))
    const headersA = { "x-real-ip": "3.3.3.3", "x-user-id": "user-a" }
    const headersB = { "x-real-ip": "3.3.3.3", "x-user-id": "user-b" }
    let blockedA = 0
    for (let i = 0; i < 70; i++) {
      const res = await handler(makeReq("http://localhost/api/user", { method: "POST" }, headersA))
      if (res.status === 429) blockedA++
    }
    let blockedB = 0
    for (let i = 0; i < 70; i++) {
      const res = await handler(makeReq("http://localhost/api/user", { method: "POST" }, headersB))
      if (res.status === 429) blockedB++
    }
    expect(blockedA).toBeGreaterThan(0)
    expect(blockedB).toBeGreaterThan(0)
  })
})

