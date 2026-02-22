import { DomainError } from '@/domain/errors'
import { prisma } from '@/lib/db'

export async function ensureDeletableDocumentVersion(id: string): Promise<void> {
  const dv = await prisma.documentVersion.findFirst({ where: { id }, select: { status: true } })
  if (dv && dv.status === 'SENT') {
    throw new DomainError('IMMUTABLE_ENTITY', 'Cannot delete a sent document', 409)
  }
}

export async function ensureDeletableBillingMonth(id: string): Promise<void> {
  const bm = await prisma.billingMonth.findFirst({ where: { id }, select: { closed: true } })
  if (bm && bm.closed) {
    throw new DomainError('IMMUTABLE_ENTITY', 'Cannot delete a closed billing month', 409)
  }
}

