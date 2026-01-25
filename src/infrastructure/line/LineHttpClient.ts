export class LineHttpClient {
  private readonly baseUrl = "https://api.line.me/v2/bot"
  private readonly token: string
  constructor(token: string) {
    this.token = token
  }
  async pushMessage(input: { to: string; messages: Array<{ type: "text"; text: string }> }): Promise<void> {
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
}
