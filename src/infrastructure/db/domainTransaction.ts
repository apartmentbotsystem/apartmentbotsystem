import { prisma } from "@/infrastructure/db/prisma/prismaClient"
export async function domainTransaction<T>(fn: (tx: unknown) => Promise<T>): Promise<T> {
  return prisma.$transaction(async (tx) => fn(tx))
}
