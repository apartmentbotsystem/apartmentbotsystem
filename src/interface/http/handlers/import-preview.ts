import { withErrorHandling } from "@/interface/http/withErrorHandling"
import { respondOk } from "@/interface/http/response"
import { requireRole } from "@/lib/guards"
import { ValidationError } from "@/interface/errors/ValidationError"
import { httpError, HttpError } from "@/interface/errors/HttpError"
import { ErrorCodes } from "@/interface/errors/error-codes"
import * as XLSX from "xlsx"
import { parseExcelInvoiceRows } from "@/modules/invoice/import/excel-invoice.parser"
import { validateExcelInvoiceRows } from "@/modules/invoice/import/excel-invoice.validator"
import { importInvoicesFromExcel } from "@/modules/invoice/import/excel-invoice.importer"
import { PrismaRoomRepository } from "@/infrastructure/db/prisma/repositories/PrismaRoomRepository"
import { PrismaTenantRepository } from "@/infrastructure/db/prisma/repositories/PrismaTenantRepository"
import { PrismaInvoiceRepository } from "@/infrastructure/db/prisma/repositories/PrismaInvoiceRepository"

function ensureExcelHeaders(buf: Buffer): void {
  try {
    const wb = XLSX.read(buf, { type: "buffer" })
    const sheetName = wb.SheetNames[0]
    if (!sheetName) throw new ValidationError("Invalid Excel format: no sheets")
    const ws = wb.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json<string[][]>(ws, { header: 1 })
    if (rows.length < 1) throw new ValidationError("Invalid Excel format: empty sheet")
    const headers = rows[0].map((h) => String(h).trim())
    const required = ["invoiceNo", "roomNo", "tenantName", "amount", "issueDate", "dueDate", "status"]
    const missing = required.filter((h) => !headers.includes(h))
    if (missing.length > 0) {
      throw httpError(ErrorCodes.INVALID_EXCEL_FORMAT, `Missing headers: ${missing.join(", ")}`)
    }
  } catch (e) {
    if (e instanceof ValidationError || e instanceof HttpError) throw e
    throw new ValidationError("Invalid Excel format")
  }
}

export const POST = withErrorHandling(async (req: Request): Promise<Response> => {
  await requireRole(req, ["ADMIN"])
  const form = await req.formData()
  const file = form.get("file")
  if (!file || typeof file === "string") {
    throw new ValidationError("Missing file field")
  }
  const buf = Buffer.from(await (file as Blob).arrayBuffer())

  ensureExcelHeaders(buf)

  const rawRows = parseExcelInvoiceRows(buf)
  const { validRows, invalidRows } = validateExcelInvoiceRows(rawRows)

  const roomRepo = new PrismaRoomRepository()
  const tenantRepo = new PrismaTenantRepository()
  const invoiceRepo = new PrismaInvoiceRepository()
  const deps = {
    roomRepo: {
      findByNumber: (n: string) => roomRepo.findByNumber(n),
    },
    tenantRepo: {
      findAll: (f: { roomId?: string; nameContains?: string }) => tenantRepo.findAll(f),
    },
    invoiceRepo: {
      exists: (i: { roomId: string; tenantId: string; month: string }) => invoiceRepo.exists(i),
      createDraft: async () => {
        throw new ValidationError("Mutation not allowed in preview")
      },
      transitionStatus: async () => {
        throw new ValidationError("Mutation not allowed in preview")
      },
    },
  }

  const importResult = await importInvoicesFromExcel(validRows, { dryRun: true }, deps)
  const preview = {
    totalRows: validRows.length + invalidRows.length,
    validRows: validRows.length,
    invalidRows: invalidRows.length,
    failures: importResult.failures,
    nextAction: validRows.length > 0 ? ("UPLOAD_REAL" as const) : ("FIX_EXCEL" as const),
  }
  return respondOk(req, preview, 200)
})
