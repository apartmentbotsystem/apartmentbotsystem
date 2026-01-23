import type { ErrorCode } from "@/interface/errors/error-codes"
import { ErrorStatus } from "@/interface/errors/error-codes"

export class HttpError extends Error {
  status: number
  code: ErrorCode
  constructor(status: number, code: ErrorCode, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

export function httpError(code: ErrorCode, message: string): HttpError {
  const status = ErrorStatus[code]
  return new HttpError(status, code, message)
}
