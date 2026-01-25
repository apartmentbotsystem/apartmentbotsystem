import { z } from "zod"
import type { ZodIssue } from "zod"
import type { RawInvoiceRow, ImportInvoiceRowDTO, ValidationResult } from "./excel-invoice.types"

const schema = z.object({
  invoiceNo: z.string().min(1),
  roomNo: z.string().min(1),
  tenantName: z.string().min(1),
  amount: z.coerce.number().finite().positive(),
  issueDate: z.coerce.date(),
  dueDate: z.coerce.date(),
  status: z.enum(["DRAFT", "ISSUED"]),
})

export function validateExcelInvoiceRows(rows: RawInvoiceRow[]): ValidationResult {
  const validRows: ImportInvoiceRowDTO[] = []
  const invalidRows: { rowNumber: number; reason: string }[] = []
  for (const r of rows) {
    const parsed = schema.safeParse({
      invoiceNo: r.invoiceNo,
      roomNo: r.roomNo,
      tenantName: r.tenantName,
      amount: r.amount,
      issueDate: r.issueDate,
      dueDate: r.dueDate,
      status: r.status,
    })
    if (!parsed.success) {
      const reason = parsed.error.issues.map((e: ZodIssue) => e.message).join("; ")
      invalidRows.push({ rowNumber: r.rowNumber, reason })
      continue
    }
    const data = parsed.data
    const dto: ImportInvoiceRowDTO = {
      rowNumber: r.rowNumber,
      invoiceNo: data.invoiceNo,
      roomNo: data.roomNo,
      tenantName: data.tenantName,
      amount: data.amount,
      issueDate: new Date(data.issueDate).toISOString().slice(0, 10),
      dueDate: new Date(data.dueDate).toISOString().slice(0, 10),
      status: data.status,
    }
    validRows.push(dto)
  }
  return { validRows, invalidRows }
}
