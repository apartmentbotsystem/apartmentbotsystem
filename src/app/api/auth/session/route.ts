import { withErrorHandling } from "@/interface/http/withErrorHandling"
import { respondOk } from "@/interface/http/response"
import { auth } from "@/lib/auth.config"

export const runtime = "nodejs"

export const GET = withErrorHandling(async (req: Request): Promise<Response> => {
  const session = await auth(req)
  if (!session) {
    return respondOk(req, { userId: null, role: null, capabilities: [] }, 200)
  }
  return respondOk(req, { userId: session.userId ?? null, role: session.role ?? null, capabilities: session.capabilities ?? [] }, 200)
})
