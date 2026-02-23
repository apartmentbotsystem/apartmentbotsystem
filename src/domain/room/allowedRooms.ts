export function buildAllowedRooms(): string[] {
  const rooms: string[] = []

  for (let n = 1; n <= 15; n++) {
    rooms.push(`798/${n}`)
  }

  for (let floor = 2; floor <= 8; floor++) {
    const series = 30 + floor // 32..38
    for (let n = 1; n <= 32; n++) {
      rooms.push(`${series}${String(n).padStart(2, '0')}`)
    }
  }

  return rooms
}

export const ALLOWED_ROOM_SET = new Set(buildAllowedRooms())

export function isAllowedRoomNumber(roomNumber: string): boolean {
  return ALLOWED_ROOM_SET.has(String(roomNumber).trim())
}

