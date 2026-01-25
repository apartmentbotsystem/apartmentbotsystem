import { describe, it, expect } from "vitest"
import * as XLSX from "xlsx"
import { parseExcelInvoiceRows } from "../excel-invoice.parser"
import { validateExcelInvoiceRows } from "../excel-invoice.validator"

describe("Excel Invoice Parse & Validate", () => {
  it("parses rows and validates, separating valid and invalid", () => {
    const data = [
      ["invoiceNo", "roomNo", "tenantName", "amount", "issueDate", "dueDate", "status"],
      ["INV-001", "101", "John Doe", 1200, "2025-01-05", "2025-01-31", "ISSUED"],
      ["INV-002", "102", "Jane Roe", 1000, "2025-01-06", "2025-01-31", "PAID"],
    ]
    const ws = XLSX.utils.aoa_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1")
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" })
    const rawRows = parseExcelInvoiceRows(buf)
    const result = validateExcelInvoiceRows(rawRows)
    expect(result.validRows.length).toBe(1)
    expect(result.invalidRows.length).toBe(1)
    expect(result.validRows[0].invoiceNo).toBe("INV-001")
    expect(result.validRows[0].issueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(result.invalidRows[0].rowNumber).toBe(3)
  })
})
