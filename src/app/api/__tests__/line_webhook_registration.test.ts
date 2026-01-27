import { describe, it, expect, vi, beforeEach } from "vitest"
vi.mock("@/infrastructure/db/prisma/prismaClient", () => {
  const tenantFindFirst = vi.fn()
  const regFindUnique = vi.fn()
  const regCreate = vi.fn()
  const regUpdate = vi.fn()
  return {
    prisma: {
      tenant: { findFirst: tenantFindFirst },
      tenantRegistration: { findUnique: regFindUnique, create: regCreate, update: regUpdate },
    },
  }
})
import { POST } from "@/app/api/line/webhook/route"
import crypto from "node:crypto"
import { prisma } from "@/infrastructure/db/prisma/prismaClient"

function sign(body: string, secret: string) {
  return crypto.createHmac("sha256", secret).update(body).digest("base64")
}

describe("LINE webhook registration", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.clearAllMocks()
    process.env.LINE_CHANNEL_SECRET = "secret"
    process.env.LINE_CHANNEL_ACCESS_TOKEN = "token"
  })

  it("rejects invalid signature", async () => {
    const body = JSON.stringify({ events: [] })
    const req = new Request("http://localhost/api/line/webhook", {
      method: "POST",
      headers: { "x-line-signature": "bad" },
      body,
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it("creates registration on keyword", async () => {
    const body = JSON.stringify({
      events: [
        {
          type: "message",
          replyToken: "r1",
          source: { type: "user", userId: "u1" },
          message: { type: "text", text: "สมัคร" },
        },
      ],
    })
    const sig = sign(body, "secret")
    vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true, status: 200, text: async () => "" } as Response)
    ;(prisma.tenant.findFirst as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    ;(prisma.tenantRegistration.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    const createReg = prisma.tenantRegistration.create as unknown as ReturnType<typeof vi.fn>
    createReg.mockResolvedValue({
      id: "r1",
      lineUserId: "u1",
      roomId: null,
      status: "PENDING",
      createdAt: new Date(),
      approvedAt: null,
      approvedBy: null,
      tenantId: null,
    } satisfies Awaited<ReturnType<typeof prisma.tenantRegistration.create>>)
    const req = new Request("http://localhost/api/line/webhook", {
      method: "POST",
      headers: { "x-line-signature": sig },
      body,
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(prisma.tenantRegistration.findUnique).toHaveBeenCalled()
    expect(createReg).toHaveBeenCalled()
  })

  it("prevents duplicate while PENDING", async () => {
    const body = JSON.stringify({
      events: [
        {
          type: "message",
          replyToken: "r1",
          source: { type: "user", userId: "u1" },
          message: { type: "text", text: "ลงทะเบียน" },
        },
      ],
    })
    const sig = sign(body, "secret")
    vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true, status: 200, text: async () => "" } as Response)
    ;(prisma.tenant.findFirst as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    ;(prisma.tenantRegistration.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "r1",
      lineUserId: "u1",
      roomId: null,
      status: "PENDING",
      createdAt: new Date(),
      approvedAt: null,
      approvedBy: null,
      tenantId: null,
    } satisfies Awaited<ReturnType<typeof prisma.tenantRegistration.findUnique>>)
    const createReg = prisma.tenantRegistration.create as unknown as ReturnType<typeof vi.fn>
    createReg.mockResolvedValue({
      id: "r2",
      lineUserId: "u1",
      roomId: null,
      status: "PENDING",
      createdAt: new Date(),
      approvedAt: null,
      approvedBy: null,
      tenantId: null,
    } satisfies Awaited<ReturnType<typeof prisma.tenantRegistration.create>>)
    const req = new Request("http://localhost/api/line/webhook", {
      method: "POST",
      headers: { "x-line-signature": sig },
      body,
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(prisma.tenantRegistration.findUnique).toHaveBeenCalled()
    expect(createReg).not.toHaveBeenCalled()
  })

  it("REJECTED → PENDING on re-register", async () => {
    const body = JSON.stringify({
      events: [
        {
          type: "message",
          replyToken: "r1",
          source: { type: "user", userId: "u1" },
          message: { type: "text", text: "สมัคร" },
        },
      ],
    })
    const sig = sign(body, "secret")
    vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true, status: 200, text: async () => "" } as Response)
    ;(prisma.tenant.findFirst as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    ;(prisma.tenantRegistration.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "r1",
      lineUserId: "u1",
      roomId: null,
      status: "REJECTED",
      createdAt: new Date(),
      approvedAt: null,
      approvedBy: null,
      tenantId: null,
    } satisfies Awaited<ReturnType<typeof prisma.tenantRegistration.findUnique>>)
    const updateReg = prisma.tenantRegistration.update as unknown as ReturnType<typeof vi.fn>
    updateReg.mockResolvedValue({
      id: "r1",
      lineUserId: "u1",
      roomId: null,
      status: "PENDING",
      createdAt: new Date(),
      approvedAt: null,
      approvedBy: null,
      tenantId: null,
    } satisfies Awaited<ReturnType<typeof prisma.tenantRegistration.update>>)
    const req = new Request("http://localhost/api/line/webhook", {
      method: "POST",
      headers: { "x-line-signature": sig },
      body,
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(updateReg).toHaveBeenCalled()
  })
})
