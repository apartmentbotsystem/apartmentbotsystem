import { prisma } from '@/lib/db'

type Input = {
  lineUserId: string
  roomNumber: string
  residentName: string
  phone: string
}

export async function createRegistrationRequest(input: Input) {
  const { lineUserId, roomNumber, residentName, phone } = input
  const room = await prisma.room.findUnique({ where: { number: roomNumber } })
  if (!room) {
    await prisma.registrationRequest.create({
      data: {
        lineUserId,
        roomNumber,
        residentName,
        phone,
        status: 'REJECTED',
        reason: 'ROOM_NOT_FOUND'
      }
    })
    return { success: false as const, reason: 'ROOM_NOT_FOUND' as const }
  }
  await prisma.registrationRequest.create({
    data: {
      lineUserId,
      roomNumber,
      residentName,
      phone,
      status: 'PENDING'
    }
  })
  return { success: true as const }
}
