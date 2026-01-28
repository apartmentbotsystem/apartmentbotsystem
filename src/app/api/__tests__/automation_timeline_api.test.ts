import { describe, it, expect, vi, beforeEach } from "vitest"

function makeReq(url: string, init?: RequestInit, headers?: Record<string, string>) {
  const h = new Headers(init?.headers || {})
  if (headers) for (const [k, v] of Object.entries(headers)) h.set(k, v)
  return new Request(url, { ...init, headers: h })
}

const AcceptEnvelope = "application/vnd.apartment.v1.1+json"

describe("Automation Timeline API", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  it("orders timeline: Approved -> Preview -> Audits asc", async () => {
    vi.doMock("@/lib/auth.config", () => ({
      auth: async () => ({ userId: "admin-1", role: "ADMIN", capabilities: [] }),
    }))
    vi.doMock("@/domain/automation/executor", () => ({
      executeProposal: vi.fn(async () => ({ status: "SKIPPED" as const, reason: "Feature disabled" })),
    }))
    const t1 = new Date(Date.UTC(2026, 0, 2, 10))
    const t2 = new Date(Date.UTC(2026, 0, 2, 11))
    vi.doMock("@/infrastructure/db/prisma/prismaClient", () => {
      const decidedAt = new Date(Date.UTC(2026, 0, 2, 9))
      const prisma = {
        automationApproval: {
          findUnique: vi.fn(async () => ({
            id: "ap-1",
            proposalId: "p1",
            decision: "APPROVED",
            decidedBy: "admin-1",
            decidedAt,
            note: null,
            proposalSnapshot: { id: "p1", type: "REMIND_INVOICE", source: "OVERDUE_INVOICE", targetId: "inv-1", recommendedAction: "Send", reason: "r", severity: "LOW", generatedAt: new Date(0).toISOString() },
            proposalHash: "hash",
            executedAt: null,
            executeResult: null,
            createdAt: decidedAt,
          })),
        },
        automationAudit: {
          findMany: vi.fn(async () => [
            { id: "au-1", approvalId: "ap-1", proposalId: "p1", action: "EXECUTE", actorId: "admin-1", dryRun: false, result: { status: "EXECUTED" }, createdAt: t1 },
            { id: "au-2", approvalId: "ap-1", proposalId: "p1", action: "SKIP", actorId: "admin-1", dryRun: false, result: { status: "SKIPPED" }, createdAt: t2 },
          ]),
        },
      }
      return { prisma }
    })
    const route = await import("@/app/api/admin/automation/approvals/[id]/timeline/route")
    const req = makeReq("http://localhost/api/admin/automation/approvals/ap-1/timeline", { method: "GET" }, { accept: AcceptEnvelope })
    const res = await route.GET(req, { params: Promise.resolve({ id: "ap-1" }) })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    const timeline = json.data.timeline as Array<{ type: string; timestamp: string }>
    expect(timeline[0].type).toBe("APPROVED")
    expect(timeline[1].type).toBe("PREVIEW")
    expect(new Date(timeline[2].timestamp).getTime()).toBe(t1.getTime())
    expect(new Date(timeline[3].timestamp).getTime()).toBe(t2.getTime())
  })
})
