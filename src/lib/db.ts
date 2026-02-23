import { PrismaClient, Prisma } from '@prisma/client'
import type { JsonValue } from '@prisma/client/runtime/library'

const globalForPrisma = globalThis as { prisma?: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['warn', 'error']
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

async function ensureSchemaGuard() {
  if (process.env.SCHEMA_GUARD === '1' && process.env.NODE_ENV === 'production') {
    await prisma.$queryRaw`SELECT rent FROM "BillingRecord" LIMIT 1`
    await prisma.$queryRaw`SELECT locked FROM "BillingMonth" LIMIT 1`
  }
}

void ensureSchemaGuard().catch((err) => {
  console.error('SCHEMA_DRIFT_DETECTED', err)
  throw err
})

type ArgsWithData = { data?: Record<string, unknown> }
type ArgsWithWhere = { where?: Record<string, unknown> }
type ArgsWithCreateUpdate = { create?: Record<string, unknown>; update?: Record<string, unknown> }

function getStringField(data: Record<string, unknown>, key: string): string | undefined {
  const value = data[key]
  return typeof value === 'string' ? value : undefined
}

function getBooleanField(data: Record<string, unknown>, key: string): boolean | undefined {
  const value = data[key]
  return typeof value === 'boolean' ? value : undefined
}

prisma.$use(async (params: Prisma.MiddlewareParams, next: (params: Prisma.MiddlewareParams) => Promise<unknown>) => {
  if (params.model === 'Room' && (params.action === 'create' || params.action === 'upsert' || params.action === 'update')) {
    if (params.action === 'upsert') {
      const args = (params.args ?? {}) as ArgsWithCreateUpdate
      const create = (args.create ?? {})
      const roomNo = getStringField(create, 'number')
      if (roomNo && typeof create.roomNumber !== 'string') {
        create.roomNumber = roomNo
      }
      const update = (args.update ?? {})
      const roomNoUpdate = getStringField(update, 'number')
      if (roomNoUpdate && typeof update.roomNumber !== 'string') {
        update.roomNumber = roomNoUpdate
      }
    } else {
      const args = (params.args ?? {}) as ArgsWithData
      const data = (args.data ?? {})
      const roomNo = getStringField(data, 'number')
      if (roomNo && typeof data.roomNumber !== 'string') {
        data.roomNumber = roomNo
      }
    }
  }

  if (params.model === 'BillingMonth' && (params.action === 'create' || params.action === 'upsert')) {
    const applyMonthMetadata = (target: Record<string, unknown>) => {
      const y = target.year
      const m = target.month
      if (typeof y !== 'number' || typeof m !== 'number') return
      const d = new Date(y, m - 2, 1)
      if (typeof target.label !== 'string' || target.label.length === 0) {
        target.label = `${y}-${String(m).padStart(2, '0')}`
      }
      if (typeof target.consumptionYear !== 'number' || target.consumptionYear === 0) {
        target.consumptionYear = d.getFullYear()
      }
      if (typeof target.consumptionMonth !== 'number' || target.consumptionMonth === 0) {
        target.consumptionMonth = d.getMonth() + 1
      }
    }
    if (params.action === 'upsert') {
      const args = (params.args ?? {}) as ArgsWithCreateUpdate
      applyMonthMetadata(args.create ?? {})
      applyMonthMetadata(args.update ?? {})
    } else {
      const args = (params.args ?? {}) as ArgsWithData
      applyMonthMetadata(args.data ?? {})
    }
  }

  if (params.model === 'RoomResident' && (params.action === 'create' || params.action === 'update' || params.action === 'upsert')) {
    const args = (params.args ?? {}) as ArgsWithData & ArgsWithWhere
    const data = (args.data ?? {})

    const roomNumber = getStringField(data, 'roomNumber') ?? (typeof args.where?.roomNumber === 'string' ? args.where.roomNumber : undefined)
    if (roomNumber) {
      const activeResidents = await prisma.roomResident.count({ where: { roomNumber, active: true } })
      const activeVal = getBooleanField(data, 'active')
      const deltaActive = activeVal === false ? -1 : activeVal === true ? 1 : 0

      if (activeResidents + deltaActive > 2) {
        throw new Error('OCCUPANCY_LIMIT_EXCEEDED')
      }

      const roleVal = getStringField(data, 'role')
      if (roleVal === 'PRIMARY' && activeVal !== false) {
        const primaryCount = await prisma.roomResident.count({ where: { roomNumber, role: 'PRIMARY', active: true } })
        if (primaryCount >= 1) throw new Error('PRIMARY_ALREADY_EXISTS')
      }
    }
  }

  if (params.model === 'Contract' && params.action === 'create') {
    const args = (params.args ?? {}) as ArgsWithData
    const data = (args.data ?? {})
    const roomNumber = getStringField(data, 'roomNumber')

    if (roomNumber) {
      const activeResidents = await prisma.roomResident.count({ where: { roomNumber, active: true } })
      if (activeResidents >= 2) throw new Error('OCCUPANCY_FULL')
    }
  }

  if (params.model === 'DocumentVersion' && (params.action === 'update' || params.action === 'updateMany' || params.action === 'upsert')) {
    const args = (params.args ?? {}) as ArgsWithData
    const data = (args.data ?? {}) as { snapshotJson?: JsonValue; templateVersion?: number }
    if (data.snapshotJson !== undefined || data.templateVersion !== undefined) {
      throw new Error('IMMUTABLE_SNAPSHOT')
    }
  }

  return next(params)
})
