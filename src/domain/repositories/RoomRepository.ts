import { Room } from "@/domain/entities/Room"
import type { RoomStatus } from "@/domain/value-objects/RoomStatus"

export interface RoomRepository {
  findById(id: string): Promise<Room | null>
  findByNumber(number: string): Promise<Room | null>
  findAll(filter?: RoomFindFilter): Promise<Room[]>
  create(input: CreateRoomInput): Promise<Room>
  update(id: string, patch: UpdateRoomPatch): Promise<Room>
  delete(id: string): Promise<void>
  startOccupancy(roomId: string): Promise<Room>
  endOccupancy(roomId: string): Promise<Room>
}

export type RoomFindFilter = {
  status?: RoomStatus
  numberContains?: string
}

export type CreateRoomInput = {
  number: string
  status: RoomStatus
  maxOccupants: number
}

export type UpdateRoomPatch = {
  number?: string
  status?: RoomStatus
  maxOccupants?: number
}
