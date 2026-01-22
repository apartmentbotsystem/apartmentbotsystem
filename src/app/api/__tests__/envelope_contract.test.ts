import { describe, it, expect, vi, beforeEach } from "vitest"
import { z } from "zod"
import { Invoice } from "@/domain/entities/Invoice"
import { Payment } from "@/domain/entities/Payment"
import { Tenant } from "@/domain/entities/Tenant"
import { POST as InvoicesPOST } from "@/app/api/invoices/route"
import { POST as PaymentsRecordPOST } from "@/app/api/payments/record/route"
import { POST as TenantsApprovePOST } from "@/app/api/tenants/[id]/approve/route"

vi.mock("@/infrastructure/di/container", () => {
  return {
    getCreateInvoiceUseCase: () => ({
      execute: async (input: { roomId: string; tenantId: string; amount: number; month: string }) =>
        new Invoice("inv-123", input.roomId, input.tenantId, input.amount, input.month),
    }),
    getRecordPaymentUseCase: () => ({
      execute: async (input: { invoiceId: string; method: string; reference: string | null }) =>
        new Payment("pay-123", input.invoiceId, input.method, input.reference, new Date("2026-01-20T12:00:00.000Z")),
    }),
    getApproveTenantUseCase: () => ({
      execute: async (id: string) => new Tenant(id, "John Doe", null, "PRIMARY", "room-1"),
    }),
  }
})

function makeReq(url: string, init?: RequestInit, headers?: Record<string, string>) {
  const h = new Headers(init?.headers || {})
  if (headers) for (const [k, v] of Object.entries(headers)) h.set(k, v)
  return new Request(url, { ...init, headers: h })
}

const AcceptEnvelope = "application/vnd.apartment.v1.1+json"

const InvoiceDTO = z.object({
  id: z.string(),
  roomId: z.string(),
  tenantId: z.string(),
  amount: z.number(),
  month: z.string(),
})

const PaymentDTO = z.object({
  id: z.string(),
  invoiceId: z.string(),
  method: z.string(),
  reference: z.string().nullable(),
  paidAt: z.string(),
})

const TenantDTO = z.object({
  id: z.string(),
  name: z.string(),
  phone: z.string().nullable(),
  role: z.string(),
  roomId: z.string(),
})

const LegacyError = z.object({
  code: z.string(),
  message: z.string(),
})

const EnvelopeSuccess = (schema: z.ZodTypeAny) =>
  z.object({
    success: z.literal(true),
    data: schema,
  })

const EnvelopeError = z.object({
  success: z.literal(false),
  error: LegacyError,
})

function assertHeaders(res: Response) {
  expect(res.headers.get("content-type")).toContain("application/json")
  expect(res.headers.get("x-request-id")).toBeTypeOf("string")
  expect(res.headers.get("x-response-time")).toBeTypeOf("string")
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe("Invoices POST", () => {
  it("legacy success: returns DTO and headers", async () => {
    const body = { roomId: "room-1", tenantId: "tenant-1", amount: 1200, month: "2026-01" }
    const req = makeReq("http://localhost/api/invoices", { method: "POST", body: JSON.stringify(body) }, { "content-type": "application/json" })
    const res = await InvoicesPOST(req)
    expect(res.status).toBe(201)
    assertHeaders(res)
    const json = await res.json()
    InvoiceDTO.parse(json)
    expect(json).toMatchSnapshot("invoices-legacy-success")
  })

  it("envelope success: wraps DTO", async () => {
    const body = { roomId: "room-1", tenantId: "tenant-1", amount: 1200, month: "2026-01" }
    const req = makeReq(
      "http://localhost/api/invoices",
      { method: "POST", body: JSON.stringify(body) },
      { "content-type": "application/json", accept: AcceptEnvelope },
    )
    const res = await InvoicesPOST(req)
    expect(res.status).toBe(201)
    assertHeaders(res)
    const json = await res.json()
    EnvelopeSuccess(InvoiceDTO).parse(json)
    expect(json).toMatchSnapshot("invoices-envelope-success")
  })

  it("legacy error: 400 with code/message", async () => {
    const req = makeReq("http://localhost/api/invoices", { method: "POST", body: JSON.stringify({}) }, { "content-type": "application/json" })
    const res = await InvoicesPOST(req)
    expect(res.status).toBe(400)
    assertHeaders(res)
    const json = await res.json()
    LegacyError.parse(json)
    expect(json).toMatchSnapshot("invoices-legacy-error")
  })

  it("envelope error: 400 wraps error", async () => {
    const req = makeReq(
      "http://localhost/api/invoices",
      { method: "POST", body: JSON.stringify({}) },
      { "content-type": "application/json", accept: AcceptEnvelope },
    )
    const res = await InvoicesPOST(req)
    expect(res.status).toBe(400)
    assertHeaders(res)
    const json = await res.json()
    EnvelopeError.parse(json)
    expect(json).toMatchSnapshot("invoices-envelope-error")
  })
})

describe("Payments Record POST", () => {
  it("legacy success", async () => {
    const body = { invoiceId: "inv-123", method: "CASH", reference: null }
    const req = makeReq("http://localhost/api/payments/record", { method: "POST", body: JSON.stringify(body) }, { "content-type": "application/json" })
    const res = await PaymentsRecordPOST(req)
    expect(res.status).toBe(201)
    assertHeaders(res)
    const json = await res.json()
    PaymentDTO.parse(json)
    expect(json).toMatchSnapshot("payments-legacy-success")
  })

  it("envelope success", async () => {
    const body = { invoiceId: "inv-123", method: "CASH", reference: null }
    const req = makeReq(
      "http://localhost/api/payments/record",
      { method: "POST", body: JSON.stringify(body) },
      { "content-type": "application/json", accept: AcceptEnvelope },
    )
    const res = await PaymentsRecordPOST(req)
    expect(res.status).toBe(201)
    assertHeaders(res)
    const json = await res.json()
    EnvelopeSuccess(PaymentDTO).parse(json)
    expect(json).toMatchSnapshot("payments-envelope-success")
  })

  it("legacy error", async () => {
    const body = { invoiceId: "", method: "" }
    const req = makeReq("http://localhost/api/payments/record", { method: "POST", body: JSON.stringify(body) }, { "content-type": "application/json" })
    const res = await PaymentsRecordPOST(req)
    expect(res.status).toBe(400)
    assertHeaders(res)
    const json = await res.json()
    LegacyError.parse(json)
    expect(json).toMatchSnapshot("payments-legacy-error")
  })

  it("envelope error", async () => {
    const body = { invoiceId: "", method: "" }
    const req = makeReq(
      "http://localhost/api/payments/record",
      { method: "POST", body: JSON.stringify(body) },
      { "content-type": "application/json", accept: AcceptEnvelope },
    )
    const res = await PaymentsRecordPOST(req)
    expect(res.status).toBe(400)
    assertHeaders(res)
    const json = await res.json()
    EnvelopeError.parse(json)
    expect(json).toMatchSnapshot("payments-envelope-error")
  })
})

describe("Tenants Approve POST", () => {
  it("legacy success", async () => {
    const ctx = { params: Promise.resolve({ id: "tenant-1" }) }
    const req = makeReq("http://localhost/api/tenants/tenant-1/approve", { method: "POST" })
    const res = await TenantsApprovePOST(req, ctx)
    expect(res.status).toBe(200)
    assertHeaders(res)
    const json = await res.json()
    TenantDTO.parse(json)
    expect(json).toMatchSnapshot("tenants-legacy-success")
  })

  it("envelope success", async () => {
    const ctx = { params: Promise.resolve({ id: "tenant-1" }) }
    const req = makeReq(
      "http://localhost/api/tenants/tenant-1/approve",
      { method: "POST" },
      { accept: AcceptEnvelope },
    )
    const res = await TenantsApprovePOST(req, ctx)
    expect(res.status).toBe(200)
    assertHeaders(res)
    const json = await res.json()
    EnvelopeSuccess(TenantDTO).parse(json)
    expect(json).toMatchSnapshot("tenants-envelope-success")
  })

  it("legacy error", async () => {
    const ctx = { params: Promise.resolve({ id: "" }) }
    const req = makeReq("http://localhost/api/tenants//approve", { method: "POST" })
    const res = await TenantsApprovePOST(req, ctx)
    expect(res.status).toBe(400)
    assertHeaders(res)
    const json = await res.json()
    LegacyError.parse(json)
    expect(json).toMatchSnapshot("tenants-legacy-error")
  })

  it("envelope error", async () => {
    const ctx = { params: Promise.resolve({ id: "" }) }
    const req = makeReq(
      "http://localhost/api/tenants//approve",
      { method: "POST" },
      { accept: AcceptEnvelope },
    )
    const res = await TenantsApprovePOST(req, ctx)
    expect(res.status).toBe(400)
    assertHeaders(res)
    const json = await res.json()
    EnvelopeError.parse(json)
    expect(json).toMatchSnapshot("tenants-envelope-error")
  })
})
