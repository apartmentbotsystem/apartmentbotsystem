import { describe, it, expect, vi, beforeEach } from "vitest"

function makeReq(url: string, init?: RequestInit, headers?: Record<string, string>) {
  const h = new Headers(init?.headers || {})
  if (headers) for (const [k, v] of Object.entries(headers)) h.set(k, v)
  return new Request(url, { ...init, headers: h })
}

const AcceptEnvelope = "application/vnd.apartment.v1.1+json"

describe("Automation Auto-Run API", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  it("blocks when kill switch off", async () => {
    vi.stubEnv("AUTOMATION_AUTORUN_ENABLED", "false")
    vi.doMock("@/lib/auth.config", () => ({
      auth: async () => ({ userId: "admin-1", role: "ADMIN", capabilities: [] }),
    }))
    vi.stubGlobal("fetch", (async () => ({ json: async () => ({ success: true, data: { items: [] } }) })) as unknown as typeof fetch)
    const route = await import("@/app/api/admin/automation/auto-run/route")
    const req = makeReq("http://localhost/api/admin/automation/auto-run", { method: "POST" }, { accept: AcceptEnvelope })
    const res = await route.POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.reason).toBe("KILL_SWITCH_OFF")
  })

  it("never auto for HIGH severity", async () => {
    vi.stubEnv("AUTOMATION_AUTORUN_ENABLED", "true")
    vi.doMock("@/lib/auth.config", () => ({
      auth: async () => ({ userId: "admin-1", role: "ADMIN", capabilities: [] }),
    }))
    vi.stubGlobal("fetch", (async (url: string) => {
      if (url.includes("/invoices/overdue")) return { json: async () => ({ success: true, data: { items: [] } }) } as unknown as Response
      if (url.includes("/tickets/no-reply")) return { json: async () => ({ success: true, data: { items: [] } }) } as unknown as Response
      return { json: async () => ({ success: true, data: {} }) } as unknown as Response
    }) as unknown as typeof fetch)
    vi.doMock("@/domain/automation/proposal", () => ({
      generateProposals: vi.fn(() => [
        { id: "p1", type: "REMIND_INVOICE", source: "OVERDUE_INVOICE", targetId: "inv-1", recommendedAction: "Send", reason: "r", severity: "HIGH", generatedAt: new Date(0).toISOString() },
      ]),
    }))
    vi.doMock("@/infrastructure/db/prisma/prismaClient", () => {
      const prisma = {
        automationPolicy: {
          findMany: vi.fn(async () => [{ id: "pol-1", proposalType: "REMIND_INVOICE", maxSeverity: "MEDIUM", autoApprove: true, autoExecute: true, dailyLimit: 10, enabled: true }]),
        },
        automationApproval: { findUnique: vi.fn(async () => null), create: vi.fn(async () => ({})) },
        automationAudit: { create: vi.fn(async () => ({})), count: vi.fn(async () => 0) },
      }
      return { prisma }
    })
    const route = await import("@/app/api/admin/automation/auto-run/route")
    const req = makeReq("http://localhost/api/admin/automation/auto-run", { method: "POST" }, { accept: AcceptEnvelope })
    const res = await route.POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    const decisions = json.data.results.map((r: { decision: string }) => r.decision)
    expect(decisions).toContain("SKIPPED")
  })

  it("policy disabled → no-op", async () => {
    vi.stubEnv("AUTOMATION_AUTORUN_ENABLED", "true")
    vi.doMock("@/lib/auth.config", () => ({
      auth: async () => ({ userId: "admin-1", role: "ADMIN", capabilities: [] }),
    }))
    vi.stubGlobal("fetch", (async () => ({ json: async () => ({ success: true, data: { items: [] } }) })) as unknown as typeof fetch)
    vi.doMock("@/domain/automation/proposal", () => ({
      generateProposals: vi.fn(() => [
        { id: "p1", type: "REMIND_INVOICE", source: "OVERDUE_INVOICE", targetId: "inv-1", recommendedAction: "Send", reason: "r", severity: "LOW", generatedAt: new Date(0).toISOString() },
      ]),
    }))
    vi.doMock("@/infrastructure/db/prisma/prismaClient", () => {
      const prisma = {
        automationPolicy: { findMany: vi.fn(async () => [{ id: "pol-1", proposalType: "REMIND_INVOICE", maxSeverity: "MEDIUM", autoApprove: true, autoExecute: true, dailyLimit: 10, enabled: false }]) },
        automationApproval: { findUnique: vi.fn(async () => null), create: vi.fn(async () => ({})) },
        automationAudit: { create: vi.fn(async () => ({})), count: vi.fn(async () => 0) },
      }
      return { prisma }
    })
    const route = await import("@/app/api/admin/automation/auto-run/route")
    const req = makeReq("http://localhost/api/admin/automation/auto-run", { method: "POST" }, { accept: AcceptEnvelope })
    const res = await route.POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    const decisions = json.data.results.map((r: { decision: string }) => r.decision)
    expect(decisions).toContain("SKIPPED")
  })

  it("daily limit exceeded → stop + audit FAIL", async () => {
    vi.stubEnv("AUTOMATION_AUTORUN_ENABLED", "true")
    vi.doMock("@/lib/auth.config", () => ({
      auth: async () => ({ userId: "admin-1", role: "ADMIN", capabilities: [] }),
    }))
    vi.stubGlobal("fetch", (async () => ({ json: async () => ({ success: true, data: { items: [] } }) })) as unknown as typeof fetch)
    vi.doMock("@/domain/automation/proposal", () => ({
      generateProposals: vi.fn(() => [
        { id: "p1", type: "REMIND_INVOICE", source: "OVERDUE_INVOICE", targetId: "inv-1", recommendedAction: "Send", reason: "r", severity: "LOW", generatedAt: new Date(0).toISOString() },
      ]),
    }))
    vi.doMock("@/infrastructure/db/prisma/prismaClient", () => {
      const prisma = {
        automationPolicy: { findMany: vi.fn(async () => [{ id: "pol-1", proposalType: "REMIND_INVOICE", maxSeverity: "MEDIUM", autoApprove: true, autoExecute: true, dailyLimit: 0, enabled: true }]) },
        automationApproval: { findUnique: vi.fn(async () => ({ id: "ap-1", proposalId: "p1" })), create: vi.fn(async () => ({ id: "ap-1", proposalId: "p1" })) },
        automationAudit: { create: vi.fn(async () => ({})), count: vi.fn(async () => 999) },
      }
      return { prisma }
    })
    const route = await import("@/app/api/admin/automation/auto-run/route")
    const req = makeReq("http://localhost/api/admin/automation/auto-run", { method: "POST" }, { accept: AcceptEnvelope })
    const res = await route.POST(req)
    expect(res.status).toBe(200)
    const mod = await import("@/infrastructure/db/prisma/prismaClient")
    const createAudit = mod.prisma.automationAudit.create as unknown as ReturnType<typeof vi.fn>
    const calls = createAudit.mock.calls.map((c) => (c[0] as { data: { action: string } }).data.action)
    expect(calls).toContain("FAIL")
  })
})
