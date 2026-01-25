import * as XLSX from "xlsx"
import type { RawInvoiceRow } from "./excel-invoice.types"

export function parseExcelInvoiceRows(input: Buffer | ArrayBuffer | Uint8Array): RawInvoiceRow[] {
  const wb = XLSX.read(input, { type: "buffer" })
  const sheetName = wb.SheetNames[0]
  if (!sheetName) return []
  const ws = wb.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json<string[][]>(ws, { header: 1 })
  if (rows.length < 2) return []
  const headers = rows[0].map((h) => String(h).trim())
  const idx = {
    invoiceNo: headers.findIndex((h) => h === "invoiceNo"),
    roomNo: headers.findIndex((h) => h === "roomNo"),
    tenantName: headers.findIndex((h) => h === "tenantName"),
    amount: headers.findIndex((h) => h === "amount"),
    issueDate: headers.findIndex((h) => h === "issueDate"),
    dueDate: headers.findIndex((h) => h === "dueDate"),
    status: headers.findIndex((h) => h === "status"),
  }
  const result: RawInvoiceRow[] = []
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    const obj: RawInvoiceRow = {
      rowNumber: i + 1,
      invoiceNo: idx.invoiceNo >= 0 ? row[idx.invoiceNo] : undefined,
      roomNo: idx.roomNo >= 0 ? row[idx.roomNo] : undefined,
      tenantName: idx.tenantName >= 0 ? row[idx.tenantName] : undefined,
      amount: idx.amount >= 0 ? row[idx.amount] : undefined,
      issueDate: idx.issueDate >= 0 ? row[idx.issueDate] : undefined,
      dueDate: idx.dueDate >= 0 ? row[idx.dueDate] : undefined,
      status: idx.status >= 0 ? row[idx.status] : undefined,
    }
    result.push(obj)
  }
  return result
}
