declare module 'pizzip' {
  export default class PizZip {
    constructor(data?: ArrayBuffer | Uint8Array | Buffer | string);
    file(name: string, data: unknown): void;
    file(name: string): { asText(): string } | null;
    generate(options: unknown): unknown;
  }
}

declare module 'docxtemplater' {
  export default class Docxtemplater {
    constructor(zip: unknown, options?: unknown);
    render(data: Record<string, unknown>): void;
    getZip(): { generate(opts: unknown): Buffer };
  }
}
