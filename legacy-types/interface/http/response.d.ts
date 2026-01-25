declare module "@/interface/http/response" {
  export function respondOk(req: Request, data: unknown, status?: number): Response
}
