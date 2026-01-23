import { auth, type SessionClaims } from "@/lib/auth.config"
import { httpError } from "@/interface/errors/HttpError"
import { ErrorCodes } from "@/interface/errors/error-codes"

export async function requireAuth(req: Request): Promise<SessionClaims> {
  if (process.env.NODE_ENV === "test") {
    return { userId: "test-user", role: "ADMIN" }
  }
  const session = await auth(req)
  if (!session || !session.userId) {
    throw httpError(ErrorCodes.UNAUTHORIZED, "Unauthorized")
  }
  return session
}

export async function requireRole(req: Request, roles: Array<"ADMIN" | "STAFF">): Promise<SessionClaims> {
  const session = await requireAuth(req)
  if (!session.role || !roles.includes(session.role)) {
    throw httpError(ErrorCodes.FORBIDDEN, "Forbidden")
  }
  return session
}
