import { ErrorCodes } from "@/interface/errors/error-codes"

export class ValidationError extends Error {
  code: (typeof ErrorCodes)["VALIDATION_ERROR"]
  constructor(message: string) {
    super(message)
    this.code = ErrorCodes.VALIDATION_ERROR
    this.name = "ValidationError"
  }
}
