export declare class HttpError extends Error {
  status: number
  code: string
}
export declare function httpError(code: string, message: string): HttpError
