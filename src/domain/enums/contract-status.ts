export const ContractStatus = {
  ACTIVE: "ACTIVE",
  CLOSED: "CLOSED",
} as const
export type ContractStatus = (typeof ContractStatus)[keyof typeof ContractStatus]
