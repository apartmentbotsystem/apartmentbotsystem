export class DomainError extends Error {
  readonly code: string
  readonly status: number | undefined
  constructor(code: string, message: string, status?: number) {
    super(message)
    this.code = code
    this.status = status
  }
}

export class ConflictError extends DomainError {
  constructor(message = 'Concurrent update conflict') {
    super('CONFLICT', message, 409)
  }
}

export class NotFoundError extends DomainError {
  constructor(message = 'Not found') {
    super('NOT_FOUND', message, 404)
  }
}

export class ForbiddenError extends DomainError {
  constructor(message = 'Forbidden') {
    super('FORBIDDEN', message, 403)
  }
}
