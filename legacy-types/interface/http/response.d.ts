declare module "@/interface/http/response" {
  export function respondOk(req: Request, data: unknown, status?: number): Response
  export function respondError(req: Request, code: string, message: string, status: number): Response
}
