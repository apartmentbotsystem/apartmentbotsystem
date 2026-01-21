export class Payment {
  constructor(
    public readonly id: string,
    public readonly invoiceId: string,
    public readonly method: string,
    public readonly reference: string | null,
    public readonly paidAt: Date
  ) {}
}

