import { describe, it, expect } from "vitest"
import { approveTenantSchema } from "@/interface/validators/tenant.schema"
import { ValidationError } from "@/interface/errors/ValidationError"

function validate(body: unknown) {
  const parsed = approveTenantSchema.safeParse(body)
  if (!parsed.success) throw new ValidationError("Invalid tenant id")
  return parsed.data
}

describe("approveTenantSchema", () => {
  it("passes with valid id", () => {
    const data = validate({ id: "tenant-1" })
    expect(data.id).toBe("tenant-1")
  })

  it("throws ValidationError with invalid id", () => {
    expect(() => validate({ id: "" })).toThrow(ValidationError)
  })
})

