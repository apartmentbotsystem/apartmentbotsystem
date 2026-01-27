import { describe, it, expect, beforeEach, vi } from "vitest"
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
import { getRegistrationState, triggerRegistration } from "@/infrastructure/registration/registration.service"
import { prisma } from "@/infrastructure/db/prisma/prismaClient"

describe("registration.service", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.clearAllMocks()
  })
  it("NONE → PENDING on trigger", async () => {
    ;(prisma.tenant.findFirst as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    ;(prisma.tenantRegistration.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    const create = prisma.tenantRegistration.create as unknown as ReturnType<typeof vi.fn>
    create.mockResolvedValue({
      id: "r1",
      lineUserId: "u1",
      roomId: null,
      status: "PENDING",
      createdAt: new Date(),
      approvedAt: null,
      approvedBy: null,
      tenantId: null,
    } satisfies Awaited<ReturnType<typeof prisma.tenantRegistration.create>>)
    const state = await triggerRegistration("u1")
    expect(state).toBe("PENDING")
    expect(create).toHaveBeenCalled()
  })
  it("PENDING stays PENDING on duplicate", async () => {
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
    const state = await triggerRegistration("u1")
    expect(state).toBe("PENDING")
  })
  it("REJECTED → PENDING on re-register", async () => {
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
    const update = prisma.tenantRegistration.update as unknown as ReturnType<typeof vi.fn>
    update.mockResolvedValue({
      id: "r1",
      lineUserId: "u1",
      roomId: null,
      status: "PENDING",
      createdAt: new Date(),
      approvedAt: null,
      approvedBy: null,
      tenantId: null,
    } satisfies Awaited<ReturnType<typeof prisma.tenantRegistration.update>>)
    const state = await triggerRegistration("u1")
    expect(state).toBe("PENDING")
    expect(update).toHaveBeenCalled()
  })
  it("ACTIVE tenant returns ACTIVE", async () => {
    ;(prisma.tenant.findFirst as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "t1",
      name: "John",
      phone: "0800000000",
      lineUserId: "u1",
      role: "PRIMARY",
      roomId: "room1",
    } satisfies Awaited<ReturnType<typeof prisma.tenant.findFirst>>)
    const state = await getRegistrationState("u1")
    expect(state).toBe("ACTIVE")
  })
})
