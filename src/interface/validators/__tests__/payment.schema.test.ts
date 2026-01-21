import { describe, it, expect } from "vitest"
import { recordPaymentSchema } from "@/interface/validators/payment.schema"
import { ValidationError } from "@/interface/errors/ValidationError"

function validate(body: unknown) {
  const parsed = recordPaymentSchema.safeParse(body)
  if (!parsed.success) throw new ValidationError("Invalid payment input")
  return parsed.data
}

describe("recordPaymentSchema", () => {
  it("passes with valid input", () => {
    const data = validate({ invoiceId: "inv-1", method: "CASH", reference: null })
    expect(data.invoiceId).toBe("inv-1")
    expect(data.method).toBe("CASH")
    expect(data.reference).toBeNull()
  })

  it("throws ValidationError with invalid input", () => {
    expect(() => validate({ invoiceId: "", method: "" })).toThrow(ValidationError)
  })
})

