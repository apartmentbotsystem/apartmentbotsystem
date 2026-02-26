export async function canGenerate(_roomNumber: string, _billingMonthId: string): Promise<boolean> {
  return true
}

export async function canSend(_dv: { status: string }): Promise<boolean> {
  return true
}

export async function canChangeStatus(_dv: { status: string }, _next: string): Promise<boolean> {
  return true
}
