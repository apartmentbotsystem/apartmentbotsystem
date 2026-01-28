export type TenantProfileDTO = {
  room: { id: string; number: string; status: "OCCUPIED" | "AVAILABLE" | "MAINTENANCE" } | null
  contract: { startDate: string; endDate: string | null } | null
  meta: {
    status: "OK" | "STALE" | "PARTIAL" | "ERROR"
    calculatedAt: string
    freshnessMs?: number
    reason?: string
  }
}
