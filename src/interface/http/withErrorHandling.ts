import { ValidationError } from "@/interface/errors/ValidationError"
import { HttpError } from "@/interface/errors/HttpError"
import { mapDomainError } from "@/interface/errors/DomainErrorMapper"

export function withErrorHandling<C = unknown>(handler: (req: Request, ctx: C) => Promise<Response>) {
  return async (req: Request, ctx: C): Promise<Response> => {
    try {
      return await handler(req, ctx)
    } catch (e) {
      if (e instanceof ValidationError) {
        const payload = { code: e.code, message: e.message }
        return new Response(JSON.stringify(payload), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        })
      }
      if (e instanceof HttpError) {
        const payload = { code: e.code, message: e.message }
        return new Response(JSON.stringify(payload), {
          status: e.status,
          headers: { "Content-Type": "application/json" },
        })
      }
      const mapped = mapDomainError(e as Error)
      const payload = { code: mapped.code, message: mapped.message }
      return new Response(JSON.stringify(payload), {
        status: mapped.status,
        headers: { "Content-Type": "application/json" },
      })
    }
  }
}
