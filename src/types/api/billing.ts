export type BillingMonthsResponse = {
  items: Array<{
    id: string
    year: number
    month: number
    closed: boolean
    totalBilled: number
    totalReceived: number
    outstanding: number
  }>
}

export type BillingRecordsResponse = {
  items: Array<{
    id: string
    roomNumber: string
    amount: number
    note: string
    dueDate: string | null
    overdueDays: number
    penalty: number
    status: string
  }>
}
