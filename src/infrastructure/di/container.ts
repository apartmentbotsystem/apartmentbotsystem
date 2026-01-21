import { CreateInvoiceUseCase } from "@/application/usecases/create-invoice.usecase"
import { ApproveTenantUseCase } from "@/application/usecases/approve-tenant.usecase"
import { RecordPaymentUseCase } from "@/application/usecases/record-payment.usecase"
import { PrismaInvoiceRepository } from "@/infrastructure/db/prisma/repositories/PrismaInvoiceRepository"
import { PrismaTenantRepository } from "@/infrastructure/db/prisma/repositories/PrismaTenantRepository"
import { PrismaPaymentRepository } from "@/infrastructure/db/prisma/repositories/PrismaPaymentRepository"

export function getCreateInvoiceUseCase(): CreateInvoiceUseCase {
  return new CreateInvoiceUseCase(new PrismaInvoiceRepository())
}

export function getApproveTenantUseCase(): ApproveTenantUseCase {
  return new ApproveTenantUseCase(new PrismaTenantRepository())
}

export function getRecordPaymentUseCase(): RecordPaymentUseCase {
  return new RecordPaymentUseCase(new PrismaPaymentRepository())
}

