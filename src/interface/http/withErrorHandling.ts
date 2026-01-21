import { ValidationError } from "@/interface/errors/ValidationError"
import { mapDomainError } from "@/interface/errors/DomainErrorMapper"
import { buildRequestMeta, type RequestMeta } from "@/interface/http/request-context"
import { logger } from "@/interface/logger/logger"
import { isBodyTooLarge, recordInvalidPayload, recordRequest } from "@/interface/logger/abuse"
import { getRateLimiter } from "@/interface/rate-limit"
import { getPolicy } from "@/interface/rate-limit/policy"
import { HttpError } from "@/interface/errors/HttpError"
import { ErrorCodes } from "@/interface/errors/error-codes"
import { respondError } from "@/interface/http/response"

export function withErrorHandling<C extends object | undefined = object>(
  handler: (req: Request, ctx: C & RequestMeta) => Promise<Response>,
) {
  return async (req: Request, ctx?: C): Promise<Response> => {
    const meta = buildRequestMeta(req)
    const mergedCtx = Object.assign({}, (ctx || {}) as object, meta) as C & RequestMeta
    const start = Date.now()
    const policy = getPolicy(meta.method, meta.path)
    const identity = meta.userId || meta.ip || "unknown"
    const routeKey = `${meta.method}:${meta.path}`
    const limiter = getRateLimiter()
    const result = limiter.consume(identity, routeKey, policy.windowMs, policy.limit)
    if (!result.allowed) {
      const retrySec = Math.max(1, Math.ceil((result.retryAfterMs || policy.windowMs) / 1000))
      const res = new Response(JSON.stringify({ code: ErrorCodes.RATE_LIMIT_EXCEEDED, message: "Too many requests" }), {
        status: 429,
        headers: { "Content-Type": "application/json", "Retry-After": String(retrySec), "X-RateLimit-Remaining": String(result.remaining) },
      })
      res.headers.set("x-request-id", meta.requestId)
      res.headers.set("x-response-time", "0")
      logger.warn({
        requestId: meta.requestId,
        method: meta.method,
        path: meta.path,
        status: 429,
        userId: meta.userId,
        role: meta.role,
        limit: policy.limit,
        windowMs: policy.windowMs,
        remaining: result.remaining,
      })
      return res
    }
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
        const elapsed = Date.now() - start
        const res = respondError(req, e.code, e.message, 400)
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
        const elapsed = Date.now() - start
        const res = respondError(req, e.code, e.message, e.status)
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
      const elapsed = Date.now() - start
      const res = respondError(req, mapped.code, mapped.message, mapped.status)
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
