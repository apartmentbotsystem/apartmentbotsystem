import { HttpError } from "@/interface/errors/HttpError"

type MaybeDomainError = Error & { code?: string }

export function mapDomainError(err: MaybeDomainError): HttpError {
  if (err.name === "DomainError" && typeof err.code === "string") {
    const code = err.code
    switch (code) {
      case "TENANT_NOT_FOUND":
        return new HttpError(404, code, "Tenant does not exist")
      case "INVOICE_ALREADY_EXISTS":
        return new HttpError(409, code, "Invoice already exists")
      case "PAYMENT_DUPLICATE":
        return new HttpError(409, code, "Duplicate payment")
      default:
        return new HttpError(400, code, err.message || "Bad request")
    }
  }
  return new HttpError(500, "INTERNAL_ERROR", "Internal server error")
}

