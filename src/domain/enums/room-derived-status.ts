export const RoomDerivedStatus = {
  AVAILABLE: "AVAILABLE",
  OCCUPIED: "OCCUPIED",
  MAINTENANCE: "MAINTENANCE",
  IN_USE: "IN_USE",
} as const
export type RoomDerivedStatus = (typeof RoomDerivedStatus)[keyof typeof RoomDerivedStatus]
