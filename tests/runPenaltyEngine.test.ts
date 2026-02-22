import { runPenaltyEngine } from '../src/lib/runPenaltyEngine'

type TxShape = {
  billingRecord: {
    findMany(): Promise<Array<{
      id: string
      dueDate: Date | null
      overdueDays: number
      penalty: number
      status: 'PENDING' | 'OVERDUE' | 'TERMINATED' | 'PAID'
      room: { type: 'AIR' | 'NORMAL'; floor: { idx: number } }
      billingMonth: { year: number; month: number; dueDay: number; closed: boolean }
    }>>
    update(args: unknown): Promise<void>
  }
}

type PrismaLike = {
  $transaction<T>(fn: (tx: TxShape) => Promise<T>): Promise<T>
}

const makeTx = (records: Array<{
  id: string
  dueDate: Date | null
  overdueDays: number
  penalty: number
  status: 'PENDING' | 'OVERDUE' | 'TERMINATED' | 'PAID'
  room: { type: 'AIR' | 'NORMAL'; floor: { idx: number } }
  billingMonth: { year: number; month: number; dueDay: number; closed: boolean }
}>) => {
  let updates = 0
  return {
    billingRecord: {
      async findMany() {
        return records
      },
      async update(): Promise<void> {
        updates++
      }
    },
    getUpdates: () => updates
  }
}

const prismaFake: PrismaLike = {
  async $transaction<T>(fn: (tx: TxShape) => Promise<T>) {
    const tx = makeTx([
      { id: '1', dueDate: null, overdueDays: 0, penalty: 0, status: 'PENDING', room: { floor: { idx: 1 }, type: 'NORMAL' }, billingMonth: { year: 2026, month: 1, dueDay: 7, closed: false } },
      { id: '2', dueDate: null, overdueDays: 0, penalty: 0, status: 'PENDING', room: { floor: { idx: 3 }, type: 'NORMAL' }, billingMonth: { year: 2026, month: 1, dueDay: 7, closed: false } }
    ])
    const result = await fn(tx as unknown as TxShape)
    const u = (tx as { getUpdates: () => number }).getUpdates()
    if (typeof result === 'object' && result && 'updated' in result) {
      const updated = (result as { updated: number }).updated
      if (updated !== u) {
        console.error(`Assertion failed: runPenaltyEngine updated count mismatch. expected ${u}, got ${updated}`)
        process.exit(1)
      }
    }
    return result
  }
}

runPenaltyEngine(prismaFake as unknown as any).then((res) => {
  if (!res || typeof res.updated !== 'number') {
    console.error('Assertion failed: runPenaltyEngine result invalid')
    process.exit(1)
  }
  console.log('runPenaltyEngine tests passed')
}).catch((e) => {
  console.error('runPenaltyEngine test error', e)
  process.exit(1)
})
