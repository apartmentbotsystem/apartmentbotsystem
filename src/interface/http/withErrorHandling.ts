import { ValidationError } from "@/interface/errors/ValidationError"
import { HttpError } from "@/interface/errors/HttpError"
import { mapDomainError } from "@/interface/errors/DomainErrorMapper"
import { buildRequestMeta, type RequestMeta } from "@/interface/http/request-context"
import { logger } from "@/interface/logger/logger"
import { isBodyTooLarge, recordInvalidPayload, recordRequest } from "@/interface/logger/abuse"

export function withErrorHandling<C extends object | undefined = object>(
  handler: (req: Request, ctx: C & RequestMeta) => Promise<Response>,
) {
  return async (req: Request, ctx?: C): Promise<Response> => {
    const meta = buildRequestMeta(req)
    const mergedCtx = Object.assign({}, (ctx || {}) as object, meta) as C & RequestMeta
    const start = Date.now()
    // abuse signals (soft)
    const sizeCheck = isBodyTooLarge(req.headers.get("content-length"))
    if (sizeCheck.tooLarge) {
      logger.warn({ requestId: meta.requestId, method: meta.method, path: meta.path, status: 200, userId: meta.userId, role: meta.role })
    }
    const reqWindow = recordRequest(meta.ip || "unknown")
    if (reqWindow.isBurst) {
      logger.warn({ requestId: meta.requestId, method: meta.method, path: meta.path, status: 200, userId: meta.userId, role: meta.role })
    }
    try {
      const res = await handler(req, mergedCtx)
      const elapsed = Date.now() - start
      res.headers.set("x-request-id", meta.requestId)
      res.headers.set("x-response-time", String(elapsed))
      logger.info({ requestId: meta.requestId, method: meta.method, path: meta.path, status: res.status, latencyMs: elapsed, userId: meta.userId, role: meta.role })
      return res
    } catch (e) {
      if (e instanceof ValidationError) {
        const payload = { code: e.code, message: e.message }
        const elapsed = Date.now() - start
        const res = new Response(JSON.stringify(payload), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        })
        res.headers.set("x-request-id", meta.requestId)
        res.headers.set("x-response-time", String(elapsed))
        const invalidWindow = recordInvalidPayload(meta.ip || "unknown")
        if (invalidWindow.isBurst) {
          logger.warn({ requestId: meta.requestId, method: meta.method, path: meta.path, status: 400, userId: meta.userId, role: meta.role })
        }
        logger.error({
          requestId: meta.requestId,
          method: meta.method,
          path: meta.path,
          status: 400,
          errorCode: e.code,
          message: e.message,
          stack: (e as Error).stack,
          userId: meta.userId,
          role: meta.role,
        })
        return res
      }
      if (e instanceof HttpError) {
        const payload = { code: e.code, message: e.message }
        const elapsed = Date.now() - start
        const res = new Response(JSON.stringify(payload), {
          status: e.status,
          headers: { "Content-Type": "application/json" },
        })
        res.headers.set("x-request-id", meta.requestId)
        res.headers.set("x-response-time", String(elapsed))
        logger.error({
          requestId: meta.requestId,
          method: meta.method,
          path: meta.path,
          status: e.status,
          errorCode: e.code,
          message: e.message,
          stack: (e as Error).stack,
          userId: meta.userId,
          role: meta.role,
        })
        return res
      }
      const mapped = mapDomainError(e as Error)
      const payload = { code: mapped.code, message: mapped.message }
      const elapsed = Date.now() - start
      const res = new Response(JSON.stringify(payload), {
        status: mapped.status,
        headers: { "Content-Type": "application/json" },
      })
      res.headers.set("x-request-id", meta.requestId)
      res.headers.set("x-response-time", String(elapsed))
      logger.error({
        requestId: meta.requestId,
        method: meta.method,
        path: meta.path,
        status: mapped.status,
        errorCode: mapped.code,
        message: mapped.message,
        stack: (e as Error).stack,
        userId: meta.userId,
        role: meta.role,
      })
      return res
    }
  }
}
