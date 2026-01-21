export class Tenant {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly phone: string | null,
    public readonly role: string,
    public readonly roomId: string
  ) {}
}

