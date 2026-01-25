// Legacy tests type-only stub; not for runtime use
declare module "@/interface/errors/HttpError" {
  export class HttpError extends Error {
    status: number
    code: string
  }
  export function httpError(code: string, message: string): HttpError
}
