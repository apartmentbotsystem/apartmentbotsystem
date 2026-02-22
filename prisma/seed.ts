import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Floor 1: 798/1 - 798/15
  const f1 = await prisma.floor.upsert({
    where: { idx: 1 },
    update: {},
    create: { idx: 1, name: 'ชั้น 1' }
  })
  for (let n = 1; n <= 15; n++) {
    const number = `798/${n}`
    await prisma.room.upsert({
      where: { number },
      update: { floorId: f1.id },
      create: { number, floorId: f1.id }
    })
  }

  // Floors 2..8: 3201-3232, 3301-3332, ... 3801-3832
  for (let idx = 2; idx <= 8; idx++) {
    const floor = await prisma.floor.upsert({
      where: { idx },
      update: {},
      create: { idx, name: `ชั้น ${idx}` }
    })
    const prefix = 30 + (idx - 1) // 31 for floor 2? Requirement says 3201 for floor 2.
    // Adjust per requirement: floor 2 => 32xx, 3 => 33xx ... 8 => 38xx
    const series = 30 + idx // 32..38
    for (let n = 1; n <= 32; n++) {
      const number = `${series}${n.toString().padStart(2, '0')}`
      await prisma.room.upsert({
        where: { number },
        update: { floorId: floor.id },
        create: { number, floorId: floor.id }
      })
    }
  }
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
