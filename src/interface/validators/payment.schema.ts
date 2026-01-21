import { z } from "zod"

export const recordPaymentSchema = z.object({
  invoiceId: z.string().min(1),
  method: z.string().min(1),
  reference: z.string().min(1).optional().nullable(),
})

export type RecordPaymentInputParsed = z.infer<typeof recordPaymentSchema>

