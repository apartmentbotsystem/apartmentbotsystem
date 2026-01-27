import { assertInvoiceTransition } from "@/domain/invoice-status"
import { describe, it, expect } from "vitest"

describe("InvoiceStatus transitions", () => {
  it("allows DRAFT -> SENT", () => {
    expect(() => assertInvoiceTransition("DRAFT", "SENT")).not.toThrow()
  })
  it("allows DRAFT -> CANCELLED", () => {
    expect(() => assertInvoiceTransition("DRAFT", "CANCELLED")).not.toThrow()
  })
  it("allows SENT -> PAID", () => {
    expect(() => assertInvoiceTransition("SENT", "PAID")).not.toThrow()
  })
  it("allows SENT -> CANCELLED", () => {
    expect(() => assertInvoiceTransition("SENT", "CANCELLED")).not.toThrow()
  })
  it("disallows PAID -> SENT", () => {
    expect(() => assertInvoiceTransition("PAID", "SENT")).toThrow()
  })
  it("disallows CANCELLED -> SENT", () => {
    expect(() => assertInvoiceTransition("CANCELLED", "SENT")).toThrow()
  })
})
