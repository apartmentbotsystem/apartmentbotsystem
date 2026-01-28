import { z } from "zod"

export const createInvoiceSchema = z.object({
  roomId: z.string().min(1),
  tenantId: z.string().min(1),
  amount: z.number().int().nonnegative(),
  month: z.string().min(1),
  ticketId: z.string().min(1).optional(),
})

export type CreateInvoiceInputParsed = z.infer<typeof createInvoiceSchema>

