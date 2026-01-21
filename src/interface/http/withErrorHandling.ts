import { ValidationError } from "@/interface/errors/ValidationError"
import { HttpError } from "@/interface/errors/HttpError"
import { mapDomainError } from "@/interface/errors/DomainErrorMapper"
import { buildRequestMeta, type RequestMeta } from "@/interface/http/request-context"
import { logger } from "@/interface/logger/logger"

export function withErrorHandling<C extends object | undefined = object>(
  handler: (req: Request, ctx: C & RequestMeta) => Promise<Response>,
) {
  return async (req: Request, ctx?: C): Promise<Response> => {
    const meta = buildRequestMeta(req)
    const mergedCtx = Object.assign({}, (ctx || {}) as object, meta) as C & RequestMeta
    try {
      const res = await handler(req, mergedCtx)
      res.headers.set("x-request-id", meta.requestId)
      logger.info({ requestId: meta.requestId, method: meta.method, path: meta.path, status: res.status })
      return res
    } catch (e) {
      if (e instanceof ValidationError) {
        const payload = { code: e.code, message: e.message }
        const res = new Response(JSON.stringify(payload), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        })
        res.headers.set("x-request-id", meta.requestId)
        logger.error({
          requestId: meta.requestId,
          method: meta.method,
          path: meta.path,
          status: 400,
          errorCode: e.code,
          message: e.message,
          stack: (e as Error).stack,
        })
        return res
      }
      if (e instanceof HttpError) {
        const payload = { code: e.code, message: e.message }
        const res = new Response(JSON.stringify(payload), {
          status: e.status,
          headers: { "Content-Type": "application/json" },
        })
        res.headers.set("x-request-id", meta.requestId)
        logger.error({
          requestId: meta.requestId,
          method: meta.method,
          path: meta.path,
          status: e.status,
          errorCode: e.code,
          message: e.message,
          stack: (e as Error).stack,
        })
        return res
      }
      const mapped = mapDomainError(e as Error)
      const payload = { code: mapped.code, message: mapped.message }
      const res = new Response(JSON.stringify(payload), {
        status: mapped.status,
        headers: { "Content-Type": "application/json" },
      })
      res.headers.set("x-request-id", meta.requestId)
      logger.error({
        requestId: meta.requestId,
        method: meta.method,
        path: meta.path,
        status: mapped.status,
        errorCode: mapped.code,
        message: mapped.message,
        stack: (e as Error).stack,
      })
      return res
    }
  }
}
