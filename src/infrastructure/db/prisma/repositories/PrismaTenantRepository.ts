import { prisma } from "@/infrastructure/db/prisma/prismaClient"
import type {
  TenantRepository,
  TenantFindFilter,
  CreateTenantInput,
  UpdateTenantPatch,
} from "@/domain/repositories/TenantRepository"
import { Tenant } from "@/domain/entities/Tenant"
import type { Prisma } from "@prisma/client"

export class PrismaTenantRepository implements TenantRepository {
  private toDomain(row: Prisma.TenantUncheckedCreateInput & { id: string }): Tenant {
    return new Tenant(row.id, row.name, row.phone ?? null, row.role, row.roomId)
  }

  async findById(id: string): Promise<Tenant | null> {
    const row = await prisma.tenant.findUnique({ where: { id } })
    return row ? this.toDomain({ ...row }) : null
  }

  async findAll(filter?: TenantFindFilter): Promise<Tenant[]> {
    const where: Prisma.TenantWhereInput = {}
    if (filter?.roomId) where.roomId = filter.roomId
    if (filter?.role) where.role = filter.role
    if (filter?.nameContains) where.name = { contains: filter.nameContains }
    const rows = await prisma.tenant.findMany({ where, orderBy: { name: "asc" }, take: 200 })
    return rows.map((r) => this.toDomain({ ...r }))
  }

  async create(input: CreateTenantInput): Promise<Tenant> {
    const row = await prisma.tenant.create({
      data: { name: input.name, phone: input.phone ?? null, role: input.role, roomId: input.roomId },
    })
    return this.toDomain({ ...row })
  }

  async update(id: string, patch: UpdateTenantPatch): Promise<Tenant> {
    const row = await prisma.tenant.update({
      where: { id },
      data: {
        name: patch.name,
        phone: patch.phone ?? undefined,
        role: patch.role,
        roomId: patch.roomId,
      },
    })
    return this.toDomain({ ...row })
  }

  async delete(id: string): Promise<void> {
    await prisma.tenant.delete({ where: { id } })
  }

  async approve(id: string): Promise<Tenant> {
    // ไม่มี field แสดงสถานะ approval ใน Domain/Schema v1
    // ดังนั้น approve จะคืนค่า entity ปัจจุบัน (no-op write)
    const current = await prisma.tenant.findUnique({ where: { id } })
    if (!current) throw new Error("Tenant not found")
    return this.toDomain({ ...current })
  }
}

