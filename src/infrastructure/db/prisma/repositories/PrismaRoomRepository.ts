import { prisma } from "@/infrastructure/db/prisma/prismaClient"
import type {
  RoomRepository,
  RoomFindFilter,
  CreateRoomInput,
  UpdateRoomPatch,
} from "@/domain/repositories/RoomRepository"
import { Room } from "@/domain/entities/Room"
import { httpError } from "@/interface/errors/HttpError"
import { ErrorCodes } from "@/interface/errors/error-codes"
type RoomRow = Awaited<ReturnType<typeof prisma.room.findMany>>[number]

export class PrismaRoomRepository implements RoomRepository {
  private toDomain(row: RoomRow): Room {
    return new Room(row.id, row.roomNumber, row.status, row.maxOccupants)
  }

  async findById(id: string): Promise<Room | null> {
    const row = await prisma.room.findUnique({ where: { id } })
    return row ? this.toDomain({ ...row }) : null
  }

  async findByNumber(number: string): Promise<Room | null> {
    const row = await prisma.room.findFirst({ where: { roomNumber: number } })
    return row ? this.toDomain({ ...row }) : null
  }

  async findAll(filter?: RoomFindFilter): Promise<Room[]> {
    const where: Record<string, unknown> = {}
    if (filter?.status) where.status = filter.status
    if (filter?.numberContains) where.roomNumber = { contains: filter.numberContains }
    const rows = await prisma.room.findMany({ where, orderBy: { roomNumber: "asc" }, take: 200 })
    return rows.map((r: RoomRow) => this.toDomain({ ...r }))
  }

  async create(input: CreateRoomInput): Promise<Room> {
    const row = await prisma.room.create({
      data: { roomNumber: input.number, status: input.status, maxOccupants: input.maxOccupants },
    })
    return this.toDomain({ ...row })
  }

  async update(id: string, patch: UpdateRoomPatch): Promise<Room> {
    const row = await prisma.room.update({
      where: { id },
      data: {
        roomNumber: patch.number,
        status: patch.status,
        maxOccupants: patch.maxOccupants,
      },
    })
    return this.toDomain({ ...row })
  }

  async delete(id: string): Promise<void> {
    await prisma.room.delete({ where: { id } })
  }

  async startOccupancy(roomId: string): Promise<Room> {
    const updated = await prisma.$transaction(async (tx) => {
      const current = await tx.room.findUnique({ where: { id: roomId } })
      if (!current) {
        throw httpError(ErrorCodes.VALIDATION_ERROR, "Invalid room id")
      }
      if (current.status !== "AVAILABLE") {
        throw httpError(ErrorCodes.ROOM_NOT_AVAILABLE, "Room not available")
      }
      await tx.roomOccupancy.create({
        data: { roomId, startedAt: new Date(), endedAt: null },
      })
      const row = await tx.room.update({
        where: { id: roomId },
        data: { status: "OCCUPIED" },
      })
      return row
    })
    return this.toDomain({ ...updated })
  }

  async endOccupancy(roomId: string): Promise<Room> {
    const updated = await prisma.$transaction(async (tx) => {
      const current = await tx.room.findUnique({ where: { id: roomId } })
      if (!current) {
        throw httpError(ErrorCodes.VALIDATION_ERROR, "Invalid room id")
      }
      if (current.status !== "OCCUPIED") {
        throw httpError(ErrorCodes.VALIDATION_ERROR, "Invalid room state")
      }
      const last = await tx.roomOccupancy.findFirst({
        where: { roomId, endedAt: null },
        orderBy: { startedAt: "desc" },
      })
      if (last) {
        await tx.roomOccupancy.update({
          where: { id: last.id },
          data: { endedAt: new Date() },
        })
      }
      const row = await tx.room.update({
        where: { id: roomId },
        data: { status: "AVAILABLE" },
      })
      return row
    })
    return this.toDomain({ ...updated })
  }

  async getOccupancyTimeline(roomId: string): Promise<Array<{ id: string; startedAt: Date; endedAt: Date | null }>> {
    const room = await prisma.room.findUnique({ where: { id: roomId } })
    if (!room) {
      throw httpError(ErrorCodes.VALIDATION_ERROR, "Room not found")
    }
    const rows = await prisma.roomOccupancy.findMany({
      where: { roomId },
      orderBy: { startedAt: "desc" },
      take: 200,
    })
    return rows.map((r) => ({
      id: r.id,
      startedAt: r.startedAt,
      endedAt: r.endedAt ?? null,
    }))
  }
}
