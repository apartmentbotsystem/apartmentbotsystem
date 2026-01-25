export type ImportFailure = {
  rowNumber: number
  invoiceNo?: string
  reason: string
}

export type ImportResult = {
  totalRows: number
  successCount: number
  failureCount: number
  failures: ImportFailure[]
}
