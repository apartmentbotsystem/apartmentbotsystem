type LogLevel = "info" | "warn" | "error"

type BaseLog = {
  requestId: string
  method: string
  path: string
  timestamp: string
  userId?: string
  role?: string
}

type InfoLog = BaseLog & {
  level: LogLevel
  status?: number
  latencyMs?: number
  limit?: number
  windowMs?: number
  remaining?: number
}

type ErrorLog = BaseLog & {
  level: LogLevel
  status: number
  errorCode?: string
  message?: string
  stack?: string
}

function emit(obj: unknown, level: LogLevel) {
  const line = JSON.stringify(obj)
  if (level === "error") {
    console.error(line)
  } else if (level === "warn") {
    console.warn(line)
  } else {
    console.log(line)
  }
}

export const logger = {
  info(payload: Omit<InfoLog, "level" | "timestamp">) {
    const out: InfoLog = {
      ...payload,
      level: "info",
      timestamp: new Date().toISOString(),
    }
    emit(out, "info")
  },
  warn(payload: Omit<InfoLog, "level" | "timestamp">) {
    const out: InfoLog = {
      ...payload,
      level: "warn",
      timestamp: new Date().toISOString(),
    }
    emit(out, "warn")
  },
  error(payload: Omit<ErrorLog, "level" | "timestamp">) {
    const out: ErrorLog = {
      ...payload,
      level: "error",
      timestamp: new Date().toISOString(),
    }
    emit(out, "error")
  },
}
