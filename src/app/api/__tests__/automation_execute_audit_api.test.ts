import { describe, it, expect, vi, beforeEach } from "vitest"

function makeReq(url: string, init?: RequestInit, headers?: Record<string, string>) {
  const h = new Headers(init?.headers || {})
  if (headers) for (const [k, v] of Object.entries(headers)) h.set(k, v)
  return new Request(url, { ...init, headers: h })
}

const AcceptEnvelope = "application/vnd.apartment.v1.1+json"

describe("Automation Execute API (audit writing)", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  it("writes audit when dryRun=false", async () => {
    vi.doMock("@/lib/auth.config", () => ({
      auth: async () => ({ userId: "admin-1", role: "ADMIN", capabilities: [] }),
    }))
    vi.doMock("@/domain/automation/executor", () => ({
      executeProposal: vi.fn(async () => ({ status: "EXECUTED" as const, targetType: "INVOICE", targetId: "inv-1" })),
    }))
    vi.doMock("@/infrastructure/db/prisma/prismaClient", () => {
      const now = new Date()
      const prisma = {
        automationApproval: {
          findUnique: vi.fn(async () => ({
            id: "ap-1",
            proposalId: "p1",
            decision: "APPROVED",
            decidedBy: "admin-1",
            decidedAt: now,
            note: null,
            proposalSnapshot: { id: "p1", type: "REMIND_INVOICE", source: "OVERDUE_INVOICE", targetId: "inv-1", recommendedAction: "Send", reason: "r", severity: "LOW", generatedAt: new Date(0).toISOString() },
            proposalHash: "hash",
            executedAt: null,
            executeResult: null,
            createdAt: now,
          })),
          update: vi.fn(async () => ({})),
        },
        automationAudit: {
          create: vi.fn(async () => ({})),
          update: vi.fn(async () => ({})),
          delete: vi.fn(async () => ({})),
        },
      }
      return { prisma }
    })
    const route = await import("@/app/api/admin/automation/execute/route")
    const req = makeReq("http://localhost/api/admin/automation/execute", { method: "POST", body: JSON.stringify({ approvalId: "ap-1", dryRun: false }) }, { accept: AcceptEnvelope, "content-type": "application/json" })
    const res = await route.POST(req)
    expect(res.status).toBe(200)
    const mod = await import("@/infrastructure/db/prisma/prismaClient")
    const createAudit = mod.prisma.automationAudit.create as unknown as ReturnType<typeof vi.fn>
    const updateAudit = mod.prisma.automationAudit.update as unknown as ReturnType<typeof vi.fn>
    const deleteAudit = mod.prisma.automationAudit.delete as unknown as ReturnType<typeof vi.fn>
    expect(createAudit).toHaveBeenCalled()
    expect(updateAudit).not.toHaveBeenCalled()
    expect(deleteAudit).not.toHaveBeenCalled()
  })

  it("does not write audit when dryRun=true", async () => {
    vi.doMock("@/lib/auth.config", () => ({
      auth: async () => ({ userId: "admin-1", role: "ADMIN", capabilities: [] }),
    }))
    vi.doMock("@/domain/automation/executor", () => ({
      executeProposal: vi.fn(async () => ({ status: "SKIPPED" as const, reason: "Feature disabled", targetType: "INVOICE", targetId: "inv-1" })),
    }))
    vi.doMock("@/infrastructure/db/prisma/prismaClient", () => {
      const now = new Date()
      const prisma = {
        automationApproval: {
          findUnique: vi.fn(async () => ({
            id: "ap-1",
            proposalId: "p1",
            decision: "APPROVED",
            decidedBy: "admin-1",
            decidedAt: now,
            note: null,
            proposalSnapshot: { id: "p1", type: "REMIND_INVOICE", source: "OVERDUE_INVOICE", targetId: "inv-1", recommendedAction: "Send", reason: "r", severity: "LOW", generatedAt: new Date(0).toISOString() },
            proposalHash: "hash",
            executedAt: null,
            executeResult: null,
            createdAt: now,
          })),
        },
        automationAudit: {
          create: vi.fn(async () => ({})),
        },
      }
      return { prisma }
    })
    const route = await import("@/app/api/admin/automation/execute/route")
    const req = makeReq("http://localhost/api/admin/automation/execute", { method: "POST", body: JSON.stringify({ approvalId: "ap-1", dryRun: true }) }, { accept: AcceptEnvelope, "content-type": "application/json" })
    const res = await route.POST(req)
    expect(res.status).toBe(200)
    const mod = await import("@/infrastructure/db/prisma/prismaClient")
    const createAudit = mod.prisma.automationAudit.create as unknown as ReturnType<typeof vi.fn>
    expect(createAudit).not.toHaveBeenCalled()
  })
})
