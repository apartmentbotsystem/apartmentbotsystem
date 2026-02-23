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

async function main() {
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

  console.log(
    JSON.stringify(
      {
        ok: true,
        email: user.email,
        seededPassword: adminPassword,
        userId: user.id,
        tenantCode: tenant.code,
        roles: ['OWNER', 'ADMIN']
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
  .catch(async (err) => {
    console.error(err)
    await prisma.$disconnect()
    process.exit(1)
  })
