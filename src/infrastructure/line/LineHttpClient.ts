export class LineHttpClient {
  private readonly baseUrl = "https://api.line.me/v2/bot"
  private readonly dataBaseUrl = "https://api-data.line.me/v2/bot"
  private readonly token: string
  constructor(token: string) {
    this.token = token
  }
  async replyMessage(input: { replyToken: string; messages: Array<Record<string, unknown>> }): Promise<void> {
    const resp = await fetch(`${this.baseUrl}/message/reply`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.token}`,
      },
      body: JSON.stringify(input),
    }).catch((e) => {
      throw Object.assign(new Error(String(e.message || e)), { name: "DomainError", code: "LINE_NETWORK_ERROR" })
    })
    if (!resp.ok) {
      const text = await resp.text().catch(() => "")
      throw Object.assign(new Error(`${resp.status} ${text}`), { name: "DomainError", code: "LINE_API_ERROR" })
    }
  }
  async pushMessage(input: { to: string; messages: Array<Record<string, unknown>> }): Promise<void> {
    const resp = await fetch(`${this.baseUrl}/message/push`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.token}`,
      },
      body: JSON.stringify(input),
    }).catch((e) => {
      throw Object.assign(new Error(String(e.message || e)), { name: "DomainError", code: "LINE_NETWORK_ERROR" })
    })
    if (!resp.ok) {
      const text = await resp.text().catch(() => "")
      throw Object.assign(new Error(`${resp.status} ${text}`), { name: "DomainError", code: "LINE_API_ERROR" })
    }
  }
  async uploadFile(input: { to: string; file: Blob; filename: string }): Promise<void> {
    const form = new FormData()
    form.append("to", input.to)
    form.append("file", input.file, input.filename)
    const resp = await fetch(`${this.dataBaseUrl}/message/push`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.token}`,
      },
      body: form,
    }).catch((e) => {
      throw Object.assign(new Error(String(e.message || e)), { name: "DomainError", code: "LINE_NETWORK_ERROR" })
    })
    if (!resp.ok) {
      const text = await resp.text().catch(() => "")
      throw Object.assign(new Error(`${resp.status} ${text}`), { name: "DomainError", code: "LINE_API_ERROR" })
    }
  }
}
