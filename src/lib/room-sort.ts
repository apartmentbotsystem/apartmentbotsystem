export function compareRoomNumbersNatural(a: string, b: string): number {
  return a.localeCompare(b, 'th')
}
