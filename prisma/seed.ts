import { prisma } from "../src/infrastructure/db/prisma/prismaClient"

async function seed() {}

async function main() {
  await seed()
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
