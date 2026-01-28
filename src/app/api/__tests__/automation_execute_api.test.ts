import { describe, it, expect, vi, beforeEach } from "vitest"

function makeReq(url: string, init?: RequestInit, headers?: Record<string, string>) {
  const h = new Headers(init?.headers || {})
  if (headers) for (const [k, v] of Object.entries(headers)) h.set(k, v)
  return new Request(url, { ...init, headers: h })
}

const AcceptEnvelope = "application/vnd.apartment.v1.1+json"

describe("Automation Execute API", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  it("executes approved proposal and updates approval row", async () => {
    vi.doMock("@/lib/auth.config", () => ({
      auth: async () => ({ userId: "admin-1", role: "ADMIN", capabilities: [] }),
    }))
    vi.doMock("@/domain/automation/executor", () => ({
      executeProposal: vi.fn(async () => ({ status: "EXECUTED" as const })),
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
        },
      }
      return { prisma }
    })
    const route = await import("@/app/api/admin/automation/execute/route")
    const req = makeReq("http://localhost/api/admin/automation/execute", { method: "POST", body: JSON.stringify({ approvalId: "ap-1" }) }, { accept: AcceptEnvelope, "content-type": "application/json" })
    const res = await route.POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.status).toBe("EXECUTED")
    const mod = await import("@/infrastructure/db/prisma/prismaClient")
    const update = mod.prisma.automationApproval.update as unknown as ReturnType<typeof vi.fn>
    expect(update).toHaveBeenCalled()
  })

  it("skips when already executed", async () => {
    vi.doMock("@/lib/auth.config", () => ({
      auth: async () => ({ userId: "admin-1", role: "ADMIN", capabilities: [] }),
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
            executedAt: now,
            executeResult: { status: "EXECUTED" },
            createdAt: now,
          })),
        },
      }
      return { prisma }
    })
    const route = await import("@/app/api/admin/automation/execute/route")
    const req = makeReq("http://localhost/api/admin/automation/execute", { method: "POST", body: JSON.stringify({ approvalId: "ap-1" }) }, { accept: AcceptEnvelope, "content-type": "application/json" })
    const res = await route.POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.status).toBe("SKIPPED")
  })
})
