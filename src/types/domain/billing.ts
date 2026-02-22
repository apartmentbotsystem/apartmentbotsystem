export type BillingStatus = 'PENDING' | 'OVERDUE' | 'TERMINATED' | 'PAID'

export type BillingRecord = {
  id: string
  roomNumber: string
  amount: number
  adjustments: number
  note: string | null
  dueDate: Date | null
  overdueDays: number
  penalty: number
  status: BillingStatus
}

export type BillingMonth = {
  id: string
  year: number
  month: number
  dueDay: number
  closed: boolean
}

export type BillingMonthSummary = {
  id: string
  year: number
  month: number
  closed: boolean
  totalBilled: number
  totalReceived: number
  outstanding: number
}

export type BillingRecordPenaltyContext = {
  dueDate: Date | null
  status: BillingStatus
  room: { floorIdx: number; type: 'AIR' | 'NORMAL' }
  billingMonth: { year: number; month: number; dueDay: number }
}
