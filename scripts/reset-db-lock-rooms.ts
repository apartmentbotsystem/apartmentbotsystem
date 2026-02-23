import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function clearAllData() {
  await prisma.$executeRawUnsafe(`
    DO $$
    DECLARE
      r RECORD;
    BEGIN
      FOR r IN
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
          AND tablename <> '_prisma_migrations'
      LOOP
        EXECUTE 'TRUNCATE TABLE "' || r.tablename || '" RESTART IDENTITY CASCADE';
      END LOOP;
    END $$;
  `)
}

async function seedLockedRooms() {
  const f1 = await prisma.floor.create({ data: { idx: 1, name: 'ชั้น 1' } })
  for (let n = 1; n <= 15; n++) {
    await prisma.room.create({
      data: {
        number: `798/${n}`,
        floorId: f1.id
      }
    })
  }

  for (let floorIdx = 2; floorIdx <= 8; floorIdx++) {
    const floor = await prisma.floor.create({ data: { idx: floorIdx, name: `ชั้น ${floorIdx}` } })
    const series = 30 + floorIdx // 32..38
    for (let n = 1; n <= 32; n++) {
      await prisma.room.create({
        data: {
          number: `${series}${String(n).padStart(2, '0')}`,
          floorId: floor.id
        }
      })
    }
  }
}

async function verify() {
  const floors = await prisma.floor.findMany({
    select: { idx: true, _count: { select: { rooms: true } } },
    orderBy: { idx: 'asc' }
  })
  const rooms = await prisma.room.count()
  return { floors, rooms }
}

async function main() {
  await clearAllData()
  await seedLockedRooms()
  const summary = await verify()
  console.log(JSON.stringify(summary, null, 2))
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (err) => {
    console.error(err)
    await prisma.$disconnect()
    process.exit(1)
  })

