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
  const floorsCount = Number(process.env['SEED_FLOORS'] ?? 0)
  const roomsPerFloor = Number(process.env['SEED_ROOMS_PER_FLOOR'] ?? 0)
  if (!Number.isFinite(floorsCount) || floorsCount <= 0 || !Number.isFinite(roomsPerFloor) || roomsPerFloor <= 0) return
  await prisma.$transaction(async (tx) => {
    for (let idx = 1; idx <= floorsCount; idx++) {
      const floor = await tx.floor.upsert({
        where: { idx },
        update: { name: `ชั้น ${idx}` },
        create: { idx, name: `ชั้น ${idx}` }
      })
      const roomRows = Array.from({ length: roomsPerFloor }, (_, i) => ({
        number: `F${idx}-${String(i + 1).padStart(3, '0')}`,
        floorId: floor.id
      }))
      await tx.room.createMany({ data: roomRows, skipDuplicates: true })
    }
  })
}

async function seedDefaultAdmin() {
  const adminEmail = process.env['ADMIN_SEED_EMAIL'] ?? 'admin@apartment.local'
  const adminPassword = process.env['ADMIN_SEED_PASSWORD'] ?? 'Admin@12345'

  const result = await prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.upsert({
      where: { code: 'MAIN' },
      update: { name: 'Main Tenant' },
      create: { code: 'MAIN', name: 'Main Tenant' }
    })
    const ownerRole = await tx.role.upsert({ where: { code: 'OWNER' }, update: { name: 'Owner' }, create: { code: 'OWNER', name: 'Owner' } })
    const adminRole = await tx.role.upsert({ where: { code: 'ADMIN' }, update: { name: 'Admin' }, create: { code: 'ADMIN', name: 'Admin' } })
    await ensureRole('STAFF', 'Staff')
    const user = await tx.user.upsert({
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
    await tx.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: ownerRole.id } },
      update: {},
      create: { userId: user.id, roleId: ownerRole.id }
    })
    await tx.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: adminRole.id } },
      update: {},
      create: { userId: user.id, roleId: adminRole.id }
    })
    return { email: adminEmail, password: adminPassword, userId: user.id }
  })

  return result
}

async function main() {
  try { console.log('SEED_START') } catch {}
  await prisma.$transaction(async () => {
    await seedRooms()
  })
  const admin = await seedDefaultAdmin()
  try { console.log('SEED_SUCCESS') } catch {}

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
