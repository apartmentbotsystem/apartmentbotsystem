import { describe, it, expect, vi, beforeEach } from "vitest"
import { AutomationDryRunResponseDTO } from "@/interface/validators/report.schema"

function makeReq(url: string, init?: RequestInit, headers?: Record<string, string>) {
  const h = new Headers(init?.headers || {})
  if (headers) for (const [k, v] of Object.entries(headers)) h.set(k, v)
  return new Request(url, { ...init, headers: h })
}

const AcceptEnvelope = "application/vnd.apartment.v1.1+json"

describe("Automation Dry-Run API", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  it("is read-only: does not write DB or send notifications", async () => {
    vi.doMock("@/infrastructure/db/prisma/prismaClient", () => {
      const prisma = {
        invoice: {
          create: vi.fn(async () => ({})),
          update: vi.fn(async () => ({})),
          delete: vi.fn(async () => ({})),
        },
        ticket: {
          create: vi.fn(async () => ({})),
          update: vi.fn(async () => ({})),
          delete: vi.fn(async () => ({})),
        },
      }
      return { prisma }
    })
    vi.stubGlobal("fetch", (async (url: string) => {
      if (url.startsWith("/api/admin/automation-candidates/invoices/overdue")) {
        return {
          json: async () => ({ success: true, data: { items: [{ invoiceId: "inv-1", tenantId: "ten-1", roomId: "room-1", periodMonth: "2026-01", overdueDays: 6 }] } }),
        } as unknown as Response
      }
      if (url.startsWith("/api/admin/automation-candidates/tickets/no-reply")) {
        return {
          json: async () => ({ success: true, data: { items: [{ ticketId: "t1", daysOpen: 5, lastReplyAt: undefined }] } }),
        } as unknown as Response
      }
      return { json: async () => ({ success: true, data: {} }) } as unknown as Response
    }) as unknown as typeof fetch)
    const route = await import("@/app/api/admin/automation/dry-run/route")
    const req = makeReq("http://localhost/api/admin/automation/dry-run?minOverdueDays=4&thresholdDays=3", { method: "GET" }, { accept: AcceptEnvelope })
    const res = await route.GET(req)
    const json = await res.json()
    AutomationDryRunResponseDTO.parse(json.data)
    const prismaMod = await import("@/infrastructure/db/prisma/prismaClient")
    expect((prismaMod.prisma.invoice.create as unknown as { mock: { calls: unknown[][] } }).mock.calls.length).toBe(0)
    expect((prismaMod.prisma.invoice.update as unknown as { mock: { calls: unknown[][] } }).mock.calls.length).toBe(0)
    expect((prismaMod.prisma.invoice.delete as unknown as { mock: { calls: unknown[][] } }).mock.calls.length).toBe(0)
    expect((prismaMod.prisma.ticket.create as unknown as { mock: { calls: unknown[][] } }).mock.calls.length).toBe(0)
    expect((prismaMod.prisma.ticket.update as unknown as { mock: { calls: unknown[][] } }).mock.calls.length).toBe(0)
    expect((prismaMod.prisma.ticket.delete as unknown as { mock: { calls: unknown[][] } }).mock.calls.length).toBe(0)
  })

  it("snapshot proposals array", async () => {
    vi.stubGlobal("fetch", (async (url: string) => {
      if (url.startsWith("/api/admin/automation-candidates/invoices/overdue")) {
        return {
          json: async () => ({ success: true, data: { items: [{ invoiceId: "INV-2026-01", tenantId: "ten-1", roomId: "room-1", periodMonth: "2026-01", overdueDays: 6 }] } }),
        } as unknown as Response
      }
      if (url.startsWith("/api/admin/automation-candidates/tickets/no-reply")) {
        return {
          json: async () => ({ success: true, data: { items: [{ ticketId: "TCK-129", daysOpen: 5, lastReplyAt: undefined }] } }),
        } as unknown as Response
      }
      return { json: async () => ({ success: true, data: {} }) } as unknown as Response
    }) as unknown as typeof fetch)
    const route = await import("@/app/api/admin/automation/dry-run/route")
    const req = makeReq("http://localhost/api/admin/automation/dry-run?minOverdueDays=4&thresholdDays=3", { method: "GET" }, { accept: AcceptEnvelope })
    const res = await route.GET(req)
    const json = await res.json()
    AutomationDryRunResponseDTO.parse(json.data)
    expect(JSON.stringify(json.data.proposals)).toMatchSnapshot()
  })
})
