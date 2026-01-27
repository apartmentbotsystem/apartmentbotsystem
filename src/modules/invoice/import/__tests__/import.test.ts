import { describe, it, expect, vi } from "vitest"
import { importInvoicesFromExcel } from "../excel-invoice.importer"
import type { ImporterDeps } from "../excel-invoice.importer"
import type { ImportInvoiceRowDTO } from "../excel-invoice.types"
import type { InvoiceStatus } from "@/domain/invoice-status"

describe("Excel Importer - Real Execution", () => {
  it("imports mixed rows, SENT transition valid, invalid rows fail, idempotent", async () => {
    const rows: ImportInvoiceRowDTO[] = [
      {
        rowNumber: 2,
        invoiceNo: "INV-001",
        roomNo: "101",
        tenantName: "John Doe",
        amount: 1200,
        issueDate: "2025-01-05",
        dueDate: "2025-01-31",
        status: "SENT",
      },
      {
        rowNumber: 3,
        invoiceNo: "INV-002",
        roomNo: "999",
        tenantName: "Ghost",
        amount: 800,
        issueDate: "2025-01-05",
        dueDate: "2025-01-31",
        status: "DRAFT",
      },
    ]

    const roomRepo: ImporterDeps["roomRepo"] = {
      findByNumber: vi.fn(async (num: string) => (num === "101" ? { id: "room-101" } : null)),
    }

    const tenantRepo: ImporterDeps["tenantRepo"] = {
      findAll: vi.fn(async (filter: { roomId?: string; nameContains?: string }) =>
        filter.roomId === "room-101" && filter.nameContains === "John Doe" ? [{ id: "tenant-1", name: "John Doe", roomId: "room-101" }] : [],
      ),
    }

    const createdIds: string[] = []
    const invoiceRepo: ImporterDeps["invoiceRepo"] = {
      exists: vi.fn(async () => false),
      createDraft: vi.fn(async () => {
        const id = `inv-${createdIds.length + 1}`
        createdIds.push(id)
        return { id }
      }),
      transitionStatus: vi.fn(async (id: string, to: InvoiceStatus) => {
        if (to !== "SENT" && to !== "DRAFT") throw new Error("Invalid transition target in test")
      }),
    }

    const deps = { roomRepo, tenantRepo, invoiceRepo }
    const res1 = await importInvoicesFromExcel(rows, { dryRun: false }, deps)
    expect(res1.totalRows).toBe(2)
    expect(res1.successCount).toBe(1)
    expect(res1.failureCount).toBe(1)
    expect(res1.failures[0].reason).toBe("ROOM_NOT_FOUND")
    expect(invoiceRepo.createDraft).toHaveBeenCalledTimes(1)
    expect(invoiceRepo.transitionStatus).toHaveBeenCalledTimes(1)

    // Idempotent: run same rows again -> should be treated as already exists
    invoiceRepo.exists = vi.fn(async () => true)
    const res2 = await importInvoicesFromExcel(rows, { dryRun: false }, deps)
    expect(res2.successCount).toBe(0)
    expect(res2.failureCount).toBe(2)
    expect(res2.failures[0].reason).toBe("INVOICE_ALREADY_EXISTS")
    expect(invoiceRepo.createDraft).toHaveBeenCalledTimes(1)
  })
})
