import type { ImportInvoiceRowDTO } from "./excel-invoice.types"
import type { ImportResult } from "./excel-invoice.result"
import { assertInvoiceTransition } from "@/domain/invoice-status"
import type { InvoiceStatus } from "@/domain/invoice-status"

export type ImporterDeps = {
  roomRepo: { findByNumber(number: string): Promise<{ id: string } | null> }
  tenantRepo: {
    findAll(filter: { roomId?: string; nameContains?: string }): Promise<Array<{ id: string; name: string; roomId: string }>>
  }
  invoiceRepo: {
    createDraft(input: { roomId: string; tenantId: string; amount: number; month: string }): Promise<{ id: string }>
    transitionStatus(id: string, to: InvoiceStatus): Promise<void>
    exists(input: { roomId: string; tenantId: string; month: string }): Promise<boolean>
  }
}

export async function importInvoicesFromExcel(
  rows: ImportInvoiceRowDTO[],
  options: { dryRun: boolean },
  deps: ImporterDeps,
): Promise<ImportResult> {
  const failures: Array<{ rowNumber: number; invoiceNo?: string; reason: string }> = []
  let successCount = 0
  const seenKeys = new Set<string>()

  for (const r of rows) {
    try {
      const room = await deps.roomRepo.findByNumber(r.roomNo)
      if (!room) {
        failures.push({ rowNumber: r.rowNumber, invoiceNo: r.invoiceNo, reason: "ROOM_NOT_FOUND" })
        continue
      }
      const tenants = await deps.tenantRepo.findAll({ roomId: room.id, nameContains: r.tenantName })
      const tenant = tenants.find((t) => t.name === r.tenantName && t.roomId === room.id) ?? null
      if (!tenant) {
        failures.push({ rowNumber: r.rowNumber, invoiceNo: r.invoiceNo, reason: "TENANT_NOT_FOUND" })
        continue
      }

      const month = r.issueDate.slice(0, 7)
      const key = `${room.id}:${tenant.id}:${month}`
      if (seenKeys.has(key)) {
        failures.push({ rowNumber: r.rowNumber, invoiceNo: r.invoiceNo, reason: "DUPLICATE_IN_FILE" })
        continue
      }
      seenKeys.add(key)

      const exists = await deps.invoiceRepo.exists({ roomId: room.id, tenantId: tenant.id, month })
      if (exists) {
        failures.push({ rowNumber: r.rowNumber, invoiceNo: r.invoiceNo, reason: "INVOICE_ALREADY_EXISTS" })
        continue
      }

      if (options.dryRun) {
        assertInvoiceTransition("DRAFT", r.status)
        successCount++
        continue
      }

      const created = await deps.invoiceRepo.createDraft({
        roomId: room.id,
        tenantId: tenant.id,
        amount: r.amount,
        month,
      })
      if (r.status === "SENT") {
        await deps.invoiceRepo.transitionStatus(created.id, "SENT")
      } else {
        assertInvoiceTransition("DRAFT", "DRAFT")
      }
      successCount++
    } catch (e) {
      const reason = e instanceof Error ? e.message : "UNKNOWN_ERROR"
      failures.push({ rowNumber: r.rowNumber, invoiceNo: r.invoiceNo, reason })
    }
  }

  return {
    totalRows: rows.length,
    successCount,
    failureCount: failures.length,
    failures,
  }
}
