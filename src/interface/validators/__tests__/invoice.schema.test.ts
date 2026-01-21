import { describe, it, expect } from "vitest"
import { createInvoiceSchema } from "@/interface/validators/invoice.schema"
import { ValidationError } from "@/interface/errors/ValidationError"

function validate(body: unknown) {
  const parsed = createInvoiceSchema.safeParse(body)
  if (!parsed.success) throw new ValidationError("Invalid invoice input")
  return parsed.data
}

describe("createInvoiceSchema", () => {
  it("passes with valid input", () => {
    const data = validate({ roomId: "r1", tenantId: "t1", amount: 1000, month: "2026-01" })
    expect(data.roomId).toBe("r1")
    expect(data.tenantId).toBe("t1")
    expect(data.amount).toBe(1000)
    expect(data.month).toBe("2026-01")
  })

  it("throws ValidationError with invalid input", () => {
    expect(() => validate({ roomId: "", tenantId: "t1", amount: -1, month: "" })).toThrow(ValidationError)
  })
})

