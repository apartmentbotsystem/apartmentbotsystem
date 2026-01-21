import type { TenantRepository } from "@/domain/repositories/TenantRepository"
import { Tenant } from "@/domain/entities/Tenant"

export class ApproveTenantUseCase {
  constructor(private readonly repo: TenantRepository) {}

  async execute(id: string): Promise<Tenant> {
    return this.repo.approve(id)
  }
}

