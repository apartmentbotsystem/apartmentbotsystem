declare module "@/lib/guards" {
  export type SessionClaims = {
    userId?: string
    role?: "ADMIN" | "STAFF"
    capabilities?: string[]
  }
  export type Capability =
    | "INVOICE_READ"
    | "INVOICE_CREATE"
    | "PAYMENT_READ"
    | "PAYMENT_CONFIRM"
    | "TENANT_READ"
    | "TICKET_READ"
  export function requireAuth(req: Request): Promise<SessionClaims>
  export function requireRole(req: Request, roles: Array<"ADMIN" | "STAFF">): Promise<SessionClaims>
  export function requireCapability(req: Request, capability: Capability): Promise<SessionClaims>
}
