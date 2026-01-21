import { describe, it, expect } from "vitest"
import { mapDomainError } from "@/interface/errors/DomainErrorMapper"
import { ErrorCodes } from "@/interface/errors/error-codes"
import { HttpError } from "@/interface/errors/HttpError"

describe("DomainErrorMapper", () => {
  it("maps TENANT_NOT_FOUND to 404 HttpError", () => {
    const err = Object.assign(new Error("Tenant does not exist"), {
      name: "DomainError",
      code: ErrorCodes.TENANT_NOT_FOUND,
    })
    const mapped = mapDomainError(err)
    expect(mapped).toBeInstanceOf(HttpError)
    expect(mapped.status).toBe(404)
    expect(mapped.code).toBe(ErrorCodes.TENANT_NOT_FOUND)
  })

  it("maps unknown DomainError code to VALIDATION_ERROR 400", () => {
    const err = { name: "DomainError", code: "UNKNOWN_CODE" } as unknown as Error
    const mapped = mapDomainError(err)
    expect(mapped).toBeInstanceOf(HttpError)
    expect(mapped.status).toBe(400)
    expect(mapped.code).toBe(ErrorCodes.VALIDATION_ERROR)
  })
})
