import { PrismaClient } from '@prisma/client'
import type { Prisma } from '@prisma/client'
import { DomainError } from '@/domain/errors'

const globalForPrisma = globalThis as { prisma?: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['warn', 'error']
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

prisma.$use(async (params: Prisma.MiddlewareParams, next) => {
  if (params.model === 'RoomResident' && (params.action === 'create' || params.action === 'update' || params.action === 'upsert')) {
    const data = (params.args?.data ?? {}) as Record<string, unknown>
    const roomNumber: string | undefined =
      typeof data['roomNumber'] === 'string'
        ? (data['roomNumber'] as string)
        : (params.args as { where?: { roomNumber?: string } }).where?.roomNumber
    if (roomNumber) {
      const activeResidents = await prisma.roomResident.count({ where: { roomNumber, active: true } })
      const activeVal = (data['active'] as unknown)
      const deltaActive = activeVal === false ? -1 : activeVal === true ? 1 : 0
      if (activeResidents + deltaActive > 2) {
        throw new Error('OCCUPANCY_LIMIT_EXCEEDED')
      }
      const roleVal = (data['role'] as unknown)
      if (roleVal === 'PRIMARY' && activeVal !== false) {
        const primaryCount = await prisma.roomResident.count({ where: { roomNumber, role: 'PRIMARY', active: true } })
        if (primaryCount >= 1) throw new Error('PRIMARY_ALREADY_EXISTS')
      }
    }
  }
  if (params.model === 'Contract' && params.action === 'create') {
    const data = (params.args?.data ?? {}) as Record<string, unknown>
    const roomNumber: string | undefined = typeof data['roomNumber'] === 'string' ? (data['roomNumber'] as string) : undefined
    if (roomNumber) {
      const activeResidents = await prisma.roomResident.count({ where: { roomNumber, active: true } })
      if (activeResidents >= 2) throw new Error('OCCUPANCY_FULL')
      const primaryCount = await prisma.roomResident.count({ where: { roomNumber, role: 'PRIMARY', active: true } })
      if (primaryCount >= 1) {
        
      }
    }
  }
  if (params.model === 'DocumentVersion' && (params.action === 'update' || params.action === 'updateMany' || params.action === 'upsert')) {
    const data = (params.args?.data ?? {}) as Record<string, unknown>
    if ('snapshotJson' in data || 'templateVersion' in data) {
      throw new Error('IMMUTABLE_SNAPSHOT')
    }
  }
  return next(params)
})
