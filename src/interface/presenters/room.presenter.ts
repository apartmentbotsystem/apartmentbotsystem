import type { RoomDTO } from "@/application/dto/room.dto"
import { Room } from "@/domain/entities/Room"

export function presentRoomDTO(room: Room): RoomDTO {
  return {
    id: room.id,
    number: room.number,
    status: room.status,
    maxOccupants: room.maxOccupants,
  }
}
