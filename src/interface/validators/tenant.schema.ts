import { z } from "zod"

export const approveTenantSchema = z.object({
  id: z.string().min(1),
})

export type ApproveTenantInputParsed = z.infer<typeof approveTenantSchema>

