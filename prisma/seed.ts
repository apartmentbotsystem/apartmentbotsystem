import { PrismaClient } from '@prisma/client'
import { hashPassword } from '../src/lib/auth/password'

const prisma = new PrismaClient()

async function ensureRole(code: string, name: string) {
  return prisma.role.upsert({
    where: { code },
    update: { name },
    create: { code, name }
  })
}

async function seedRooms() {
  // Floor 1: 798/1 - 798/15
  const f1 = await prisma.floor.upsert({
    where: { idx: 1 },
    update: { name: 'ชั้น 1' },
    create: { idx: 1, name: 'ชั้น 1' }
  })

  const floor1Rooms = Array.from({ length: 15 }, (_, i) => ({
    number: `798/${i + 1}`,
    floorId: f1.id
  }))
  await prisma.room.createMany({ data: floor1Rooms, skipDuplicates: true })

  // Floors 2..8: 3201-3232, 3301-3332, ... 3801-3832
  for (let idx = 2; idx <= 8; idx++) {
    const floor = await prisma.floor.upsert({
      where: { idx },
      update: { name: `ชั้น ${idx}` },
      create: { idx, name: `ชั้น ${idx}` }
    })

    const series = 30 + idx // 32..38
    const roomRows = Array.from({ length: 32 }, (_, i) => ({
      number: `${series}${String(i + 1).padStart(2, '0')}`,
      floorId: floor.id
    }))
    await prisma.room.createMany({ data: roomRows, skipDuplicates: true })
  }
}

async function seedDefaultAdmin() {
  const adminEmail = process.env['ADMIN_SEED_EMAIL'] ?? 'admin@apartment.local'
  const adminPassword = process.env['ADMIN_SEED_PASSWORD'] ?? 'Admin@12345'

  const tenant = await prisma.tenant.upsert({
    where: { code: 'MAIN' },
    update: { name: 'Main Tenant' },
    create: { code: 'MAIN', name: 'Main Tenant' }
  })

  const ownerRole = await ensureRole('OWNER', 'Owner')
  const adminRole = await ensureRole('ADMIN', 'Admin')
  await ensureRole('STAFF', 'Staff')

  const user = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      tenantId: tenant.id,
      passwordHash: hashPassword(adminPassword)
    },
    create: {
      email: adminEmail,
      tenantId: tenant.id,
      passwordHash: hashPassword(adminPassword)
    }
  })

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: user.id, roleId: ownerRole.id } },
    update: {},
    create: { userId: user.id, roleId: ownerRole.id }
  })

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: user.id, roleId: adminRole.id } },
    update: {},
    create: { userId: user.id, roleId: adminRole.id }
  })

  return { email: adminEmail, password: adminPassword, userId: user.id }
}

async function main() {
  await seedRooms()
  const admin = await seedDefaultAdmin()

  console.log(
    JSON.stringify(
      {
        ok: true,
        adminEmail: admin.email,
        adminUserId: admin.userId,
        seededPassword: admin.password,
        note: 'Change ADMIN_SEED_PASSWORD in .env and reseed for production.'
      },
      null,
      2
    )
  )
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
