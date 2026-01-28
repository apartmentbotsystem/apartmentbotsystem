import { describe, it, expect, vi, beforeEach } from "vitest"
import { UnpaidSentInvoicesOlderThanDTO } from "@/interface/validators/report.schema"

function makeReq(url: string, init?: RequestInit, headers?: Record<string, string>) {
  const h = new Headers(init?.headers || {})
  if (headers) for (const [k, v] of Object.entries(headers)) h.set(k, v)
  return new Request(url, { ...init, headers: h })
}

const AcceptEnvelope = "application/vnd.apartment.v1.1+json"

describe("Automation Candidates: Unpaid Sent Invoices Older-Than API", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  it("is read-only: does not write to DB", async () => {
    const today = new Date(Date.UTC(2026, 0, 20))
    vi.setSystemTime(today)
    vi.doMock("@/infrastructure/db/prisma/prismaClient", () => {
      const invoice = {
        findMany: vi.fn(async () => [
          { id: "inv-1", sentAt: new Date(Date.UTC(2026, 0, 1)) },
          { id: "inv-2", sentAt: new Date(Date.UTC(2026, 0, 15)) },
        ]),
        create: vi.fn(async () => ({})),
        update: vi.fn(async () => ({})),
        delete: vi.fn(async () => ({})),
      }
      return { prisma: { invoice } }
    })
    const route = await import("@/app/api/admin/automation-candidates/invoices/unpaid-old/route")
    const req = makeReq("http://localhost/api/admin/automation-candidates/invoices/unpaid-old?minDays=7", { method: "GET" }, { accept: AcceptEnvelope })
    const res = await route.GET(req)
    const json = await res.json()
    UnpaidSentInvoicesOlderThanDTO.parse(json.data)
    const prismaMod = await import("@/infrastructure/db/prisma/prismaClient")
    expect((prismaMod.prisma.invoice.create as unknown as { mock: { calls: unknown[][] } }).mock.calls.length).toBe(0)
    expect((prismaMod.prisma.invoice.update as unknown as { mock: { calls: unknown[][] } }).mock.calls.length).toBe(0)
    expect((prismaMod.prisma.invoice.delete as unknown as { mock: { calls: unknown[][] } }).mock.calls.length).toBe(0)
  })

  it("is deterministic for same input", async () => {
    const today = new Date(Date.UTC(2026, 0, 20))
    vi.setSystemTime(today)
    vi.doMock("@/infrastructure/db/prisma/prismaClient", () => {
      const invoice = {
        findMany: vi.fn(async () => [{ id: "inv-1", sentAt: new Date(Date.UTC(2026, 0, 1)) }]),
      }
      return { prisma: { invoice } }
    })
    const route = await import("@/app/api/admin/automation-candidates/invoices/unpaid-old/route")
    const req = makeReq("http://localhost/api/admin/automation-candidates/invoices/unpaid-old?minDays=7", { method: "GET" }, { accept: AcceptEnvelope })
    const res1 = await route.GET(req)
    const res2 = await route.GET(req)
    const j1 = await res1.json()
    const j2 = await res2.json()
    UnpaidSentInvoicesOlderThanDTO.parse(j1.data)
    UnpaidSentInvoicesOlderThanDTO.parse(j2.data)
    expect(JSON.stringify(j1.data)).toBe(JSON.stringify(j2.data))
  })
})
