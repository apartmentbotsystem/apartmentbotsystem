export type ImportInvoiceRowDTO = {
  rowNumber: number
  invoiceNo: string
  roomNo: string
  tenantName: string
  amount: number
  issueDate: string
  dueDate: string
  status: "DRAFT" | "SENT"
}

export type RawInvoiceRow = {
  rowNumber: number
  invoiceNo?: unknown
  roomNo?: unknown
  tenantName?: unknown
  amount?: unknown
  issueDate?: unknown
  dueDate?: unknown
  status?: unknown
}

export type InvalidRow = {
  rowNumber: number
  reason: string
}

export type ValidationResult = {
  validRows: ImportInvoiceRowDTO[]
  invalidRows: InvalidRow[]
}
