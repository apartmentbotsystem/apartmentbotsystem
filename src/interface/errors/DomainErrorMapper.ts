import { httpError } from "@/interface/errors/HttpError"
import type { HttpError } from "@/interface/errors/HttpError"
import { ErrorCodes } from "@/interface/errors/error-codes"

type MaybeDomainError = Error & { code?: string }

export function mapDomainError(err: MaybeDomainError): HttpError {
  if (err.name === "DomainError" && typeof err.code === "string") {
    const code = err.code as keyof typeof ErrorCodes
    switch (code) {
      case "TENANT_NOT_FOUND":
        return httpError(ErrorCodes.TENANT_NOT_FOUND, "Tenant does not exist")
      case "INVOICE_ALREADY_EXISTS":
        return httpError(ErrorCodes.INVOICE_ALREADY_EXISTS, "Invoice already exists")
      case "PAYMENT_DUPLICATE":
        return httpError(ErrorCodes.PAYMENT_DUPLICATE, "Duplicate payment")
      default:
        return httpError(ErrorCodes.VALIDATION_ERROR, err.message || "Bad request")
    }
  }
  return httpError(ErrorCodes.INTERNAL_ERROR, "Internal server error")
}
