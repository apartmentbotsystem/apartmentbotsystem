export class ValidationError extends Error {
  code: string
  constructor(message: string) {
    super(message)
    this.code = "VALIDATION_ERROR"
    this.name = "ValidationError"
  }
}

