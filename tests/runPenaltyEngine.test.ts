import { runPenaltyEngine } from '../src/lib/runPenaltyEngine'

type BillingRecordRow = {
  id: string
  dueDate: Date | null
  overdueDays: number
  penalty: number
  status: 'PENDING' | 'OVERDUE' | 'TERMINATED' | 'PAID'
  room: { type: 'AIR' | 'NORMAL'; floor: { idx: number } }
  billingMonth: { year: number; month: number; dueDay: number; closed: boolean }
}

type PrismaLike = {
  billingRecord: {
    findMany(args: unknown): Promise<BillingRecordRow[]>
    updateMany(args: unknown): Promise<{ count: number }>
  }
}

const records: BillingRecordRow[] = [
  { id: '1', dueDate: null, overdueDays: 0, penalty: 0, status: 'PENDING', room: { floor: { idx: 1 }, type: 'NORMAL' }, billingMonth: { year: 2026, month: 1, dueDay: 7, closed: false } },
  { id: '2', dueDate: null, overdueDays: 0, penalty: 0, status: 'PENDING', room: { floor: { idx: 3 }, type: 'NORMAL' }, billingMonth: { year: 2026, month: 1, dueDay: 7, closed: false } }
]

let updates = 0

const prismaFake: PrismaLike = {
  billingRecord: {
    async findMany() {
      return records
    },
    async updateMany() {
      updates++
      return { count: 1 }
    }
  }
}

runPenaltyEngine(prismaFake as never)
  .then((res) => {
    if (!res || typeof res.updated !== 'number') {
      console.error('Assertion failed: runPenaltyEngine result invalid')
      process.exit(1)
    }
    if (res.updated !== updates) {
      console.error(`Assertion failed: runPenaltyEngine updated count mismatch. expected ${updates}, got ${res.updated}`)
      process.exit(1)
    }
    console.log('runPenaltyEngine tests passed')
  })
  .catch((e) => {
    console.error('runPenaltyEngine test error', e)
    process.exit(1)
  })
