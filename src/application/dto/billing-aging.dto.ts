export type AgingBucketDTO = { count: number; totalAmount: number }
export type AgingTotalsDTO = {
  overdueCount: number
  overdueAmount: number
  issuedCount: number
  overduePercentOfIssued: number
}
export type AgingBucketKey = "d0_7" | "d8_30" | "d31_plus"
export type AgingBucketOrderedItemDTO = Readonly<{
  key: AgingBucketKey
  label: string
  count: number
  totalAmount: number
}>
export type BillingAgingMetricsDTO = {
  periodMonth: string
  buckets: { d0_7: AgingBucketDTO; d8_30: AgingBucketDTO; d31_plus: AgingBucketDTO }
  bucketsOrdered: ReadonlyArray<AgingBucketOrderedItemDTO>
  totals: AgingTotalsDTO
  range: { start: string; end: string }
  meta: {
    calculatedAt: string
    version: "billing-aging@v1"
    freshnessMs: number
    isStale: boolean
    status: "OK" | "STALE" | "INCONSISTENT"
  }
}
