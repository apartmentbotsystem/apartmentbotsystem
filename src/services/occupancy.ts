import type { Prisma } from '@prisma/client'

type Params = {
  roomNumber: string
  residentId: string
  role: 'PRIMARY' | 'SECONDARY'
  startDate: Date
}

export async function addActiveResidentWithGuard(_tx: Prisma.TransactionClient, _params: Params): Promise<void> {
  return
}
