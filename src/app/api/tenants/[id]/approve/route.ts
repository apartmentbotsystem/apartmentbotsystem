import { getApproveTenantUseCase } from "@/infrastructure/di/container"
import { presentTenantDTO } from "@/interface/presenters/tenant.presenter"
import { withErrorHandling } from "@/interface/http/withErrorHandling"
import { approveTenantSchema } from "@/interface/validators/tenant.schema"
import { ValidationError } from "@/interface/errors/ValidationError"

export const runtime = "nodejs"

export const POST = withErrorHandling(async (req: Request, context: { params: Promise<{ id: string }> }): Promise<Response> => {
  const { id } = await context.params
  const parsed = approveTenantSchema.safeParse({ id })
  if (!parsed.success) {
    throw new ValidationError("Invalid tenant id")
  }
  const usecase = getApproveTenantUseCase()
  const result = await usecase.execute(parsed.data.id)
  return Response.json(presentTenantDTO(result), { status: 200 })
})
