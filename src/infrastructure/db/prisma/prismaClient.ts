import prismaPkg from "@prisma/client"
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PrismaClientCtor = new (...args: any[]) => any
const PrismaClient = (prismaPkg as unknown as { PrismaClient: PrismaClientCtor }).PrismaClient

declare global {
  var prisma: InstanceType<typeof PrismaClient> | undefined
}

export const prisma =
  global.prisma ??
  new PrismaClient({
    log: ["error", "warn"],
  })

if (process.env.NODE_ENV !== "production") {
  global.prisma = prisma
}
