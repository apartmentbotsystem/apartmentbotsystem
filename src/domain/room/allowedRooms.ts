export function buildAllowedRooms(): string[] {
  return []
}

export const ALLOWED_ROOM_SET = new Set<string>()

export function isAllowedRoomNumber(roomNumber: string): boolean {
  return String(roomNumber).trim().length > 0
}
