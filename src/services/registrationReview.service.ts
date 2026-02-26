import { prisma } from '@/lib/db'
import { sendLineMessage } from '@/infrastructure/lineGateway'
import { logAudit } from '@/services/audit'

const CAPACITY_PER_ROOM = 2

export async function approveRegistration(id: string) {
  const req = await prisma.registrationRequest.findUnique({ where: { id } })
  if (!req) {
    throw new Error('NOT_FOUND')
  }
  if (req.status !== 'PENDING') {
    throw new Error('INVALID_STATE')
  }
  const existing = await prisma.lineBinding.findUnique({ where: { lineUserId: req.lineUserId } })
  if (existing) {
    throw new Error('ALREADY_BOUND')
  }
  const room = await prisma.room.findUnique({ where: { number: req.roomNumber } })
  if (!room) {
    await prisma.registrationRequest.update({
      where: { id },
      data: { status: 'REJECTED', reason: 'Room not found' }
    })
    await sendLineMessage({ roomNumber: req.lineUserId, text: 'การลงทะเบียนของคุณถูกปฏิเสธ: Room not found' })
    await logAudit({ actorId: 'system', action: 'REGISTRATION_REJECT', entity: 'RegistrationRequest', entityId: id, metadata: { reason: 'Room not found' } })
    return { ok: true, rejected: true as const }
  }
  const count = await prisma.lineBinding.count({ where: { roomNumber: req.roomNumber } })
  if (count >= CAPACITY_PER_ROOM) {
    await prisma.registrationRequest.update({
      where: { id },
      data: { status: 'REJECTED', reason: 'Room full' }
    })
    await sendLineMessage({ roomNumber: req.lineUserId, text: 'การลงทะเบียนของคุณถูกปฏิเสธ: Room full' })
    await logAudit({ actorId: 'system', action: 'REGISTRATION_REJECT', entity: 'RegistrationRequest', entityId: id, metadata: { reason: 'Room full' } })
    return { ok: true, rejected: true as const }
  }
  await prisma.$transaction([
    prisma.lineBinding.create({
      data: {
        lineUserId: req.lineUserId,
        roomNumber: req.roomNumber
      }
    }),
    prisma.registrationRequest.update({
      where: { id },
      data: { status: 'APPROVED' }
    })
  ])
  await sendLineMessage({ roomNumber: req.lineUserId, text: 'การลงทะเบียนของคุณได้รับอนุมัติแล้ว' })
  await logAudit({ actorId: 'system', action: 'REGISTRATION_APPROVE', entity: 'RegistrationRequest', entityId: id })
  return { ok: true, approved: true as const }
}

export async function rejectRegistration(id: string, reason: string) {
  const req = await prisma.registrationRequest.findUnique({ where: { id } })
  if (!req) {
    throw new Error('NOT_FOUND')
  }
  if (req.status !== 'PENDING') {
    throw new Error('INVALID_STATE')
  }
  await prisma.registrationRequest.update({
    where: { id },
    data: { status: 'REJECTED', reason }
  })
  await sendLineMessage({ roomNumber: req.lineUserId, text: `การลงทะเบียนของคุณถูกปฏิเสธ: ${reason}` })
  await logAudit({ actorId: 'system', action: 'REGISTRATION_REJECT', entity: 'RegistrationRequest', entityId: id, metadata: { reason } })
  return { ok: true, rejected: true as const }
}
