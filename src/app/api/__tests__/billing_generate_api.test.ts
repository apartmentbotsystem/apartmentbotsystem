import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/infrastructure/db/prisma/prismaClient", () => {
  type InvoiceRow = { id: string; tenantId: string; roomId: string; periodMonth: string; rentAmount: number; waterAmount: number; electricAmount: number; totalAmount: number; status: string }
  let tenants: Array<{ id: string; roomId: string | null }> = []
  const invoices: InvoiceRow[] = []
  const contracts: Array<{ id: string; tenantId: string; roomId: string; rent: number; status: string }> = []
  function reset() {
    tenants = [
      { id: "t1", roomId: "room-1" },
      { id: "t2", roomId: "room-2" },
      { id: "t3", roomId: null },
    ]
    contracts.length = 0
    contracts.push({ id: "c1", tenantId: "t1", roomId: "room-1", rent: 5000, status: "ACTIVE" })
    contracts.push({ id: "c2", tenantId: "t2", roomId: "room-2", rent: 7000, status: "ACTIVE" })
    invoices.length = 0
  }
  reset()
  const prisma = {
    tenant: {
      findMany: vi.fn(async () => tenants.filter((t) => t.roomId !== null)),
    },
    room: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => ({ id: where.id, roomNumber: where.id.replace("room-", ""), status: "OCCUPIED" })),
    },
    contract: {
      findFirst: vi.fn(async ({ where }: { where: { tenantId: string; roomId?: string; status: string } }) =>
        contracts.find((c) => c.tenantId === where.tenantId && (!where.roomId || c.roomId === where.roomId) && c.status === where.status) ?? null,
      ),
    },
    invoice: {
      findFirst: vi.fn(async ({ where }: { where: { tenantId: string; periodMonth: string } }) =>
        invoices.find((i) => i.tenantId === where.tenantId && i.periodMonth === where.periodMonth) ?? null,
      ),
      create: vi.fn(async ({ data }: { data: Omit<InvoiceRow, "id"> }) => {
        const rec: InvoiceRow = { id: `inv-${invoices.length + 1}`, ...data }
        invoices.push(rec)
        return rec
      }),
      findMany: vi.fn(async ({ where }: { where: { periodMonth: string } }) => invoices.filter((i) => i.periodMonth === where.periodMonth)),
    },
    adminAuditLog: {
      create: vi.fn(async ({ data }: { data: { action: string; adminId: string; tenantRegistrationId: string; tenantId: string | null; lineUserId: string | null } }) => ({
        id: "a1",
        ...data,
      })),
    },
    idempotencyKey: {
      _store: [] as Array<{ key: string; endpoint: string; requestHash: string; responseSnapshot: unknown }>,
      findFirst: vi.fn(async ({ where }: { where: { key: string; endpoint: string } }) =>
        prisma.idempotencyKey._store.find((x) => x.key === where.key && x.endpoint === where.endpoint) ?? null,
      ),
      create: vi.fn(async ({ data }: { data: { key: string; endpoint: string; requestHash: string; responseSnapshot: unknown } }) => {
        prisma.idempotencyKey._store.push({ ...data })
        return { id: `k${prisma.idempotencyKey._store.length}`, ...data }
      }),
    },
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(prisma as unknown)),
  }
  return { prisma, __reset: reset }
})

describe("Billing Generate API", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    process.env.NODE_ENV = "development"
    vi.doMock("@/lib/auth.config", () => ({
      auth: async () => ({ userId: "admin-1", role: "ADMIN", capabilities: [] }),
    }))
    return import("@/infrastructure/db/prisma/prismaClient").then((mod) => {
      const anyMod = mod as unknown as { __reset?: () => void }
      anyMod.__reset && anyMod.__reset()
    })
  })

  it("generate success and totals correct", async () => {
    const route = await import("@/app/api/admin/billing/generate/route")
    const req = new Request("http://localhost/api/admin/billing/generate", {
      method: "POST",
      headers: { accept: "application/vnd.apartment.v1.1+json", "content-type": "application/json" },
      body: JSON.stringify({ period: "2026-01" }),
    })
    const res = await route.POST(req)
    expect(res.status).toBe(200)
    const { prisma } = await import("@/infrastructure/db/prisma/prismaClient")
    const rows = (await prisma.invoice.findMany({ where: { periodMonth: "2026-01" } })) as Array<{
      tenantId: string
      rentAmount: number
      totalAmount: number
    }>
    expect(rows.length).toBe(2) // t1, t2 (t3 vacated)
    const t1 = rows.find((r) => r.tenantId === "t1")
    const t2 = rows.find((r) => r.tenantId === "t2")
    expect(t1?.rentAmount).toBe(5000)
    expect(t1?.totalAmount).toBe(5000)
    expect(t2?.rentAmount).toBe(7000)
    expect(t2?.totalAmount).toBe(7000)
  })

  it("duplicate generate does not create duplicates", async () => {
    const route = await import("@/app/api/admin/billing/generate/route")
    const req = new Request("http://localhost/api/admin/billing/generate", {
      method: "POST",
      headers: { accept: "application/vnd.apartment.v1.1+json", "content-type": "application/json" },
      body: JSON.stringify({ period: "2026-01" }),
    })
    const res1 = await route.POST(req)
    expect(res1.status).toBe(200)
    const req2 = new Request("http://localhost/api/admin/billing/generate", {
      method: "POST",
      headers: { accept: "application/vnd.apartment.v1.1+json", "content-type": "application/json" },
      body: JSON.stringify({ period: "2026-01" }),
    })
    const res2 = await route.POST(req2)
    expect(res2.status).toBe(200)
    const { prisma } = await import("@/infrastructure/db/prisma/prismaClient")
    const rows = (await prisma.invoice.findMany({ where: { periodMonth: "2026-01" } })) as Array<{ id: string }>
    expect(rows.length).toBe(2)
  })

  it("idempotency key returns cached response and skips new work", async () => {
    const route = await import("@/app/api/admin/billing/generate/route")
    const req1 = new Request("http://localhost/api/admin/billing/generate", {
      method: "POST",
      headers: { accept: "application/vnd.apartment.v1.1+json", "content-type": "application/json", "x-idempotency-key": "key-1" },
      body: JSON.stringify({ period: "2026-02" }),
    })
    const res1 = await route.POST(req1)
    expect(res1.status).toBe(200)
    const json1 = await res1.json()
    expect(json1?.data?.period).toBe("2026-02")
    const { prisma } = await import("@/infrastructure/db/prisma/prismaClient")
    const storeLen = (prisma.idempotencyKey._store as unknown as Array<unknown>).length
    expect(storeLen).toBe(1)
    const req2 = new Request("http://localhost/api/admin/billing/generate", {
      method: "POST",
      headers: { accept: "application/vnd.apartment.v1.1+json", "content-type": "application/json", "x-idempotency-key": "key-1" },
      body: JSON.stringify({ period: "2026-02" }),
    })
    const res2 = await route.POST(req2)
    expect(res2.status).toBe(200)
    const json2 = await res2.json()
    expect(json2?.data?.period).toBe("2026-02")
    const storeLenAfter = (prisma.idempotencyKey._store as unknown as Array<unknown>).length
    expect(storeLenAfter).toBe(1)
  })

  it("non-admin -> 403", async () => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.doMock("@/lib/auth.config", () => ({
      auth: async () => ({ userId: "staff-1", role: "STAFF", capabilities: [] }),
    }))
    const route = await import("@/app/api/admin/billing/generate/route")
    const req = new Request("http://localhost/api/admin/billing/generate", {
      method: "POST",
      headers: { accept: "application/vnd.apartment.v1.1+json", "content-type": "application/json" },
      body: JSON.stringify({ period: "2026-01" }),
    })
    const res = await route.POST(req)
    expect(res.status).toBe(403)
  })
})
