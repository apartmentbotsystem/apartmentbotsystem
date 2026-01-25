import { describe, it, expect, vi } from "vitest"
import { importInvoicesFromExcel } from "../excel-invoice.importer"
import type { ImporterDeps } from "../excel-invoice.importer"
import type { ImportInvoiceRowDTO } from "../excel-invoice.types"

describe("Excel Importer - Dry Run", () => {
  it("validates domain/transition rules without DB writes", async () => {
    const rows: ImportInvoiceRowDTO[] = [
      {
        rowNumber: 2,
        invoiceNo: "INV-001",
        roomNo: "101",
        tenantName: "John Doe",
        amount: 1200,
        issueDate: "2025-01-05",
        dueDate: "2025-01-31",
        status: "ISSUED",
      },
    ]

    const roomRepo: ImporterDeps["roomRepo"] = {
      findByNumber: vi.fn(async () => ({ id: "room-101" })),
    }

    const tenantRepo: ImporterDeps["tenantRepo"] = {
      findAll: vi.fn(async () => [{ id: "tenant-1", name: "John Doe", roomId: "room-101" }]),
    }

    const invoiceRepo: ImporterDeps["invoiceRepo"] = {
      exists: vi.fn(async () => false),
      createDraft: vi.fn(async () => {
        throw new Error("Should not be called in dry run")
      }),
      transitionStatus: vi.fn(async () => {
        throw new Error("Should not be called in dry run")
      }),
    }

    const deps = { roomRepo, tenantRepo, invoiceRepo }
    const res = await importInvoicesFromExcel(rows, { dryRun: true }, deps)
    expect(res.totalRows).toBe(1)
    expect(res.successCount).toBe(1)
    expect(res.failureCount).toBe(0)
    expect(invoiceRepo.createDraft).not.toHaveBeenCalled()
    expect(invoiceRepo.transitionStatus).not.toHaveBeenCalled()
  })
})
