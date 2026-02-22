import { computePenalty } from './penaltyEngine'
import { Mappers } from '@/types'
import type { Domain } from '@/types'
import { Prisma } from '@prisma/client'
import type { PrismaClient } from '@prisma/client'

export async function runPenaltyEngine(prisma: PrismaClient) {
  const records = await prisma.billingRecord.findMany({
    where: { NOT: { status: 'PAID' } },
    include: { room: { include: { floor: true } }, billingMonth: true }
  })
  let updated = 0
  for (const r of records) {
    const ctx = Mappers.mapRecordDbToPenaltyContext(r)
    const { dueDate, overdueDays, penalty, status } = computePenalty(ctx)
    const needUpdate =
      (r.dueDate?.toISOString() ?? '') !== (dueDate?.toISOString() ?? '') ||
      r.overdueDays !== overdueDays ||
      Number(r.penalty ?? 0) !== Number(penalty ?? 0) ||
      r.status !== status
    if (needUpdate) {
      await prisma.billingRecord.updateMany({
        where: { id: r.id },
        data: { dueDate, overdueDays, penalty, status }
      })
      updated++
    }
  }
  return { updated }
}
