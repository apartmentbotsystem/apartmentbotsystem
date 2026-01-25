import { assertInvoiceTransition } from "@/domain/invoice-status"
import { describe, it, expect } from "vitest"

describe("InvoiceStatus transitions", () => {
  it("allows DRAFT -> ISSUED", () => {
    expect(() => assertInvoiceTransition("DRAFT", "ISSUED")).not.toThrow()
  })
  it("allows DRAFT -> CANCELLED", () => {
    expect(() => assertInvoiceTransition("DRAFT", "CANCELLED")).not.toThrow()
  })
  it("allows ISSUED -> PAID", () => {
    expect(() => assertInvoiceTransition("ISSUED", "PAID")).not.toThrow()
  })
  it("allows ISSUED -> CANCELLED", () => {
    expect(() => assertInvoiceTransition("ISSUED", "CANCELLED")).not.toThrow()
  })
  it("disallows PAID -> ISSUED", () => {
    expect(() => assertInvoiceTransition("PAID", "ISSUED")).toThrow()
  })
  it("disallows CANCELLED -> ISSUED", () => {
    expect(() => assertInvoiceTransition("CANCELLED", "ISSUED")).toThrow()
  })
})
