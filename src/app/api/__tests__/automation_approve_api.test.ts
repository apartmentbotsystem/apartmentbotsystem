import { describe, it, expect, vi, beforeEach } from "vitest"
import { AutomationApprovalDTO } from "@/interface/validators/report.schema"

function makeReq(url: string, init?: RequestInit, headers?: Record<string, string>) {
  const h = new Headers(init?.headers || {})
  if (headers) for (const [k, v] of Object.entries(headers)) h.set(k, v)
  return new Request(url, { ...init, headers: h })
}

const AcceptEnvelope = "application/vnd.apartment.v1.1+json"

describe("Automation Approve API", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  it("creates approval record with snapshot and hash", async () => {
    vi.doMock("@/lib/auth.config", () => ({
      auth: async () => ({ userId: "admin-1", role: "ADMIN", capabilities: [] }),
    }))
    vi.doMock("@/infrastructure/db/prisma/prismaClient", () => {
      const now = new Date()
      const prisma = {
        automationApproval: {
          findUnique: vi.fn(async () => null),
          create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
            id: "ap-1",
            proposalId: String(data["proposalId"]),
            decision: String(data["decision"]),
            decidedBy: String(data["decidedBy"]),
            decidedAt: now,
            note: (data["note"] as string | null) ?? null,
            proposalSnapshot: data["proposalSnapshot"],
            proposalHash: String(data["proposalHash"]),
            executedAt: null,
            executeResult: null,
            createdAt: now,
          })),
        },
      }
      return { prisma }
    })
    const route = await import("@/app/api/admin/automation/approve/route")
    const body = {
      proposal: {
        id: "inv-1|REMIND_INVOICE|OVERDUE_INVOICE|7",
        type: "REMIND_INVOICE",
        source: "OVERDUE_INVOICE",
        targetId: "inv-1",
        recommendedAction: "Send overdue reminder",
        reason: "overdue 7 days",
        severity: "MEDIUM",
        generatedAt: new Date(0).toISOString(),
      },
      decision: "APPROVED",
      note: "OK",
    }
    const req = makeReq("http://localhost/api/admin/automation/approve", { method: "POST", body: JSON.stringify(body) }, { accept: AcceptEnvelope, "content-type": "application/json" })
    const res = await route.POST(req)
    expect(res.status).toBe(201)
    const json = await res.json()
    AutomationApprovalDTO.parse(json.data)
    const mod = await import("@/infrastructure/db/prisma/prismaClient")
    const create = mod.prisma.automationApproval.create as unknown as ReturnType<typeof vi.fn>
    expect(create).toHaveBeenCalled()
  })

  it("rejects duplicate decision on same proposalId", async () => {
    vi.doMock("@/lib/auth.config", () => ({
      auth: async () => ({ userId: "admin-1", role: "ADMIN", capabilities: [] }),
    }))
    vi.doMock("@/infrastructure/db/prisma/prismaClient", () => {
      const prisma = {
        automationApproval: {
          findUnique: vi.fn(async () => ({ id: "ap-1" })),
        },
      }
      return { prisma }
    })
    const route = await import("@/app/api/admin/automation/approve/route")
    const body = {
      proposal: {
        id: "inv-1|REMIND_INVOICE|OVERDUE_INVOICE|7",
        type: "REMIND_INVOICE",
        source: "OVERDUE_INVOICE",
        targetId: "inv-1",
        recommendedAction: "Send overdue reminder",
        reason: "overdue 7 days",
        severity: "MEDIUM",
        generatedAt: new Date(0).toISOString(),
      },
      decision: "APPROVED",
    }
    const req = makeReq("http://localhost/api/admin/automation/approve", { method: "POST", body: JSON.stringify(body) }, { accept: AcceptEnvelope, "content-type": "application/json" })
    const res = await route.POST(req)
    expect(res.status).toBe(400)
  })
})
