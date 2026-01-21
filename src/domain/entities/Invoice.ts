export class Invoice {
  constructor(
    public readonly id: string,
    public readonly roomId: string,
    public readonly tenantId: string,
    public readonly amount: number,
    public readonly month: string
  ) {}
}

