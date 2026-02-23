function tokenizeRoom(roomNumber: string): Array<string | number> {
  return roomNumber
    .split(/(\d+)/)
    .filter((part) => part.length > 0)
    .map((part) => (/^\d+$/.test(part) ? Number(part) : part.toLowerCase()))
}

export function compareRoomNumbersNatural(a: string, b: string): number {
  const aa = tokenizeRoom(a)
  const bb = tokenizeRoom(b)
  const len = Math.max(aa.length, bb.length)
  for (let i = 0; i < len; i++) {
    const left = aa[i]
    const right = bb[i]
    if (left === undefined) return -1
    if (right === undefined) return 1
    if (left === right) continue
    if (typeof left === 'number' && typeof right === 'number') return left - right
    if (typeof left === 'number') return -1
    if (typeof right === 'number') return 1
    return left.localeCompare(right, 'th')
  }
  return 0
}
