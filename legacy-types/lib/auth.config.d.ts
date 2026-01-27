declare module "@/lib/auth.config" {
  export type Role = "ADMIN" | "STAFF"
  export type SessionClaims = {
    userId?: string
    role?: Role
    iat?: number
    sessionVersion?: number
    capabilities?: string[]
  }
  export function verifySession(value: string | undefined): Promise<SessionClaims | null>
  export function auth(req?: Request): Promise<SessionClaims | null>
}
