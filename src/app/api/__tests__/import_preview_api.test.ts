import { describe, it, expect, vi, beforeEach } from "vitest"
import * as XLSX from "xlsx"

vi.mock("@/lib/guards", () => ({
  requireRole: async () => ({ userId: "admin-1", role: "ADMIN" }),
}))

vi.mock("@/infrastructure/db/prisma/repositories/PrismaRoomRepository", () => {
  return {
    PrismaRoomRepository: class {
      async findByNumber(num: string) {
        return num === "101" ? { id: "room-101" } : null
      }
    },
  }
})

vi.mock("@/infrastructure/db/prisma/repositories/PrismaTenantRepository", () => {
  return {
    PrismaTenantRepository: class {
      async findAll(filter: { roomId?: string; nameContains?: string }) {
        if (filter.roomId === "room-101" && filter.nameContains === "John Doe") {
          return [{ id: "tenant-1", name: "John Doe", roomId: "room-101" }]
        }
        return []
      }
    },
  }
})

const createInvoiceRepoMock = () => {
  const calls = { createDraft: 0, transitionStatus: 0, exists: 0 }
  return {
    PrismaInvoiceRepository: class {
      async exists(input: { roomId: string; tenantId: string; month: string }) {
        void input
        calls.exists++
        return false
      }
      async createDraft() {
        calls.createDraft++
        throw new Error("Should not be called in preview")
      }
      async transitionStatus() {
        calls.transitionStatus++
        throw new Error("Should not be called in preview")
      }
    },
    calls,
  }
}

describe("Excel Import Preview API", () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it("upload excel valid -> preview + nextAction=UPLOAD_REAL, dryRun no mutation", async () => {
    const data = [
      ["invoiceNo", "roomNo", "tenantName", "amount", "issueDate", "dueDate", "status"],
      ["INV-001", "101", "John Doe", 1200, "2025-01-05", "2025-01-31", "SENT"],
      ["INV-002", "999", "Ghost", 800, "2025-01-05", "2025-01-31", "DRAFT"],
    ]
    const ws = XLSX.utils.aoa_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1")
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" })

    const { PrismaInvoiceRepository, calls } = createInvoiceRepoMock()
    vi.doMock("@/infrastructure/db/prisma/repositories/PrismaInvoiceRepository", () => ({ PrismaInvoiceRepository }))

    const fd = new FormData()
    fd.append("file", new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), "data.xlsx")
    const req = new Request("http://localhost/api/invoices/import/preview", {
      method: "POST",
      body: fd,
      headers: { accept: "application/vnd.apartment.v1.1+json" },
    })
    const { POST: PreviewPOST } = await import("@/interface/http/handlers/import-preview")
    const res = await PreviewPOST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.totalRows).toBe(2)
    expect(json.data.validRows).toBe(2)
    expect(json.data.invalidRows).toBe(0)
    expect(json.data.nextAction).toBe("UPLOAD_REAL")
    expect(Array.isArray(json.data.failures)).toBe(true)

    expect(calls.createDraft).toBe(0)
    expect(calls.transitionStatus).toBe(0)
    expect(calls.exists).toBeGreaterThanOrEqual(1)
  })

  it("upload excel with missing headers -> 400 INVALID_EXCEL_FORMAT", async () => {
    const data = [
      ["invoiceNo", "roomNo", "tenantName", "amount", "issueDate", "dueDate"],
      ["INV-001", "101", "John Doe", 1200, "2025-01-05", "2025-01-31"],
    ]
    const ws = XLSX.utils.aoa_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1")
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" })

    const fd = new FormData()
    fd.append("file", new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), "data.xlsx")
    const req = new Request("http://localhost/api/invoices/import/preview", {
      method: "POST",
      body: fd,
      headers: { accept: "application/vnd.apartment.v1.1+json" },
    })
    const { POST: PreviewPOST } = await import("@/interface/http/handlers/import-preview")
    const res = await PreviewPOST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.error.code).toBe("INVALID_EXCEL_FORMAT")
  })

  it("upload excel invalid rows only -> nextAction=FIX_EXCEL", async () => {
    const data = [
      ["invoiceNo", "roomNo", "tenantName", "amount", "issueDate", "dueDate", "status"],
      // invalid status
      ["INV-001", "101", "John Doe", 1200, "2025-01-05", "2025-01-31", "PAID"],
    ]
    const ws = XLSX.utils.aoa_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1")
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" })

    const { PrismaInvoiceRepository } = createInvoiceRepoMock()
    vi.doMock("@/infrastructure/db/prisma/repositories/PrismaInvoiceRepository", () => ({ PrismaInvoiceRepository }))

    const fd = new FormData()
    fd.append("file", new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), "data.xlsx")
    const req = new Request("http://localhost/api/invoices/import/preview", {
      method: "POST",
      body: fd,
      headers: { accept: "application/vnd.apartment.v1.1+json" },
    })
    const { POST: PreviewPOST } = await import("@/interface/http/handlers/import-preview")
    const res = await PreviewPOST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.totalRows).toBe(1)
    expect(json.data.validRows).toBe(0)
    expect(json.data.invalidRows).toBe(1)
    expect(json.data.nextAction).toBe("FIX_EXCEL")
  })
})
