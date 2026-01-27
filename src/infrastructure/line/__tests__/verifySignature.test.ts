import { describe, it, expect } from "vitest"
import { verifyLineSignature } from "@/infrastructure/line/verifySignature"
import crypto from "node:crypto"

describe("verifyLineSignature", () => {
  it("accepts valid signature", () => {
    const secret = "s"
    const body = JSON.stringify({ hello: "world" })
    const sig = crypto.createHmac("sha256", secret).update(body).digest("base64")
    expect(verifyLineSignature(sig, body, secret)).toBe(true)
  })
  it("rejects invalid signature", () => {
    const secret = "s"
    const body = JSON.stringify({ hello: "world" })
    const sig = "invalid"
    expect(verifyLineSignature(sig, body, secret)).toBe(false)
  })
  it("rejects missing secret/signature", () => {
    expect(verifyLineSignature(null, "{}", undefined)).toBe(false)
  })
})
