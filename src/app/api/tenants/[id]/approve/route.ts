import { getApproveTenantUseCase } from "@/infrastructure/di/container"
import { presentTenantDTO } from "@/interface/presenters/tenant.presenter"

export const runtime = "nodejs"

export async function POST(req: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await context.params
  const usecase = getApproveTenantUseCase()
  const result = await usecase.execute(id)
  return Response.json(presentTenantDTO(result), { status: 200 })
}

