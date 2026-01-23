import { prisma } from "@/infrastructure/db/prisma/prismaClient"
import type {
  RoomRepository,
  RoomFindFilter,
  CreateRoomInput,
  UpdateRoomPatch,
} from "@/domain/repositories/RoomRepository"
import { Room } from "@/domain/entities/Room"
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
}
