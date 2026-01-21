import { Tenant } from "@/domain/entities/Tenant"
import type { TenantDTO } from "@/application/dto/tenant.dto"

export function presentTenantDTO(t: Tenant): TenantDTO {
  return {
    id: t.id,
    name: t.name,
    phone: t.phone,
    role: t.role,
    roomId: t.roomId,
  }
}

