import type { ErrorCode } from "@/interface/errors/error-codes"

export class HttpError extends Error {
  status: number
  code: ErrorCode
  constructor(status: number, code: ErrorCode, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}
