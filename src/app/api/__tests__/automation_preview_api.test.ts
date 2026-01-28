import { describe, it, expect, vi, beforeEach } from "vitest"

function makeReq(url: string, init?: RequestInit, headers?: Record<string, string>) {
  const h = new Headers(init?.headers || {})
  if (headers) for (const [k, v] of Object.entries(headers)) h.set(k, v)
  return new Request(url, { ...init, headers: h })
}

const AcceptEnvelope = "application/vnd.apartment.v1.1+json"

describe("Automation Preview API", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  it("returns same result as execute(dryRun=true) and does not write DB", async () => {
    vi.doMock("@/lib/auth.config", () => ({
      auth: async () => ({ userId: "admin-1", role: "ADMIN", capabilities: [] }),
    }))
    const execResult = { status: "SKIPPED" as const, reason: "Feature disabled", targetType: "INVOICE", targetId: "inv-1" }
    const executeProposal = vi.fn(async () => execResult)
    vi.doMock("@/domain/automation/executor", () => ({
      executeProposal,
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
      }
      return { prisma }
    })
    const previewRoute = await import("@/app/api/admin/automation/approvals/[id]/preview/route")
    const reqPreview = makeReq("http://localhost/api/admin/automation/approvals/ap-1/preview", { method: "GET" }, { accept: AcceptEnvelope })
    const resPreview = await previewRoute.GET(reqPreview, { params: Promise.resolve({ id: "ap-1" }) })
    expect(resPreview.status).toBe(200)
    const jsonPreview = await resPreview.json()
    expect(jsonPreview.success).toBe(true)
    expect(jsonPreview.data).toEqual(execResult)

    const execRoute = await import("@/app/api/admin/automation/execute/route")
    const reqExec = makeReq("http://localhost/api/admin/automation/execute", { method: "POST", body: JSON.stringify({ approvalId: "ap-1", dryRun: true }) }, { accept: AcceptEnvelope, "content-type": "application/json" })
    const resExec = await execRoute.POST(reqExec)
    const jsonExec = await resExec.json()
    expect(jsonExec.success).toBe(true)
    expect(jsonExec.data).toEqual(execResult)

    const mod = await import("@/infrastructure/db/prisma/prismaClient")
    const update = mod.prisma.automationApproval.update as unknown as ReturnType<typeof vi.fn>
    expect(update).not.toHaveBeenCalled()
    expect(executeProposal).toHaveBeenCalledTimes(2)
  })
})
