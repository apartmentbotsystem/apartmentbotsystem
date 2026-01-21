import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"
import { FLOOR_ROOM_RULES, type SlashRule, type RangeRule } from "../src/core/project-rules/room.rules"
import { assertValidRoomNumber } from "../src/core/project-rules/room-guard"
import { sortRoomNumbers } from "../src/core/project-rules/room-sorter"

const prisma = new PrismaClient()

function generateAllRoomNumbers(): string[] {
  const result: string[] = []
  const floor1 = FLOOR_ROOM_RULES[1] as SlashRule
  for (let n = floor1.from; n <= floor1.to; n += 1) {
    result.push(`${floor1.prefix}${n}`)
  }
  for (let floor = 2; floor <= 8; floor += 1) {
    const rule = FLOOR_ROOM_RULES[floor] as RangeRule
    for (let num = rule.from; num <= rule.to; num += 1) {
      result.push(String(num))
    }
  }
  return result.sort(sortRoomNumbers)
}

async function seedRooms() {
  const rooms = generateAllRoomNumbers()
  for (const roomNumber of rooms) {
    assertValidRoomNumber(roomNumber)
    await prisma.room.upsert({
      where: { roomNumber },
      update: {},
      create: { roomNumber, status: "AVAILABLE", maxOccupants: 2 },
    })
  }
}

async function seedUsers() {
  const ownerUsername = process.env.SEED_OWNER_USERNAME || "owner"
  const ownerPassword = process.env.SEED_OWNER_PASSWORD || "owner123"
  const adminUsername = process.env.SEED_ADMIN_USERNAME || "admin"
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "admin123"

  const ownerHash = await bcrypt.hash(ownerPassword, 10)
  const adminHash = await bcrypt.hash(adminPassword, 10)

  await prisma.user.upsert({
    where: { username: ownerUsername },
    update: { role: "OWNER", passwordHash: ownerHash },
    create: { username: ownerUsername, role: "OWNER", passwordHash: ownerHash },
  })
  await prisma.user.upsert({
    where: { username: adminUsername },
    update: { role: "ADMIN", passwordHash: adminHash },
    create: { username: adminUsername, role: "ADMIN", passwordHash: adminHash },
  })
}

async function main() {
  await seedRooms()
  await seedUsers()
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
