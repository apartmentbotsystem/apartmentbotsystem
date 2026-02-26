type Fields = Record<string, unknown>

export function logInfo(event: string, fields?: Fields) {
  try {
    console.log(JSON.stringify({ level: 'info', event, ...fields }))
  } catch {
    console.log(`info ${event}`)
  }
}

export function logWarn(event: string, fields?: Fields) {
  try {
    console.warn(JSON.stringify({ level: 'warn', event, ...fields }))
  } catch {
    console.warn(`warn ${event}`)
  }
}

export function logError(event: string, fields?: Fields) {
  try {
    console.error(JSON.stringify({ level: 'error', event, ...fields }))
  } catch {
    console.error(`error ${event}`)
  }
}
