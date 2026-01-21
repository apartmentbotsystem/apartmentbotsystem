import { Tenant } from "@/domain/entities/Tenant"

export interface TenantRepository {
  findById(id: string): Promise<Tenant | null>
  findAll(filter?: TenantFindFilter): Promise<Tenant[]>
  create(input: CreateTenantInput): Promise<Tenant>
  update(id: string, patch: UpdateTenantPatch): Promise<Tenant>
  delete(id: string): Promise<void>
  approve(id: string): Promise<Tenant>
}

export type TenantFindFilter = {
  roomId?: string
  role?: string
  nameContains?: string
}

export type CreateTenantInput = {
  name: string
  phone?: string | null
  role: string
  roomId: string
}

export type UpdateTenantPatch = {
  name?: string
  phone?: string | null
  role?: string
  roomId?: string
}
