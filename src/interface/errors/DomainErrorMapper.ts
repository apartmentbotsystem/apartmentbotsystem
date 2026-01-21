import { HttpError } from "@/interface/errors/HttpError"
import { ErrorCodes } from "@/interface/errors/error-codes"

type MaybeDomainError = Error & { code?: string }

export function mapDomainError(err: MaybeDomainError): HttpError {
  if (err.name === "DomainError" && typeof err.code === "string") {
    const code = err.code as keyof typeof ErrorCodes
    switch (code) {
      case "TENANT_NOT_FOUND":
        return new HttpError(404, ErrorCodes.TENANT_NOT_FOUND, "Tenant does not exist")
      case "INVOICE_ALREADY_EXISTS":
        return new HttpError(409, ErrorCodes.INVOICE_ALREADY_EXISTS, "Invoice already exists")
      case "PAYMENT_DUPLICATE":
        return new HttpError(409, ErrorCodes.PAYMENT_DUPLICATE, "Duplicate payment")
      default:
        return new HttpError(400, ErrorCodes.VALIDATION_ERROR, err.message || "Bad request")
    }
  }
  return new HttpError(500, ErrorCodes.INTERNAL_ERROR, "Internal server error")
}
