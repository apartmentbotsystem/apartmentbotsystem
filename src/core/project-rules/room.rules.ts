export type SlashRule = { prefix: string; from: number; to: number }
export type RangeRule = { from: number; to: number }
export const FLOOR_ROOM_RULES: Record<number, SlashRule | RangeRule> = {}
