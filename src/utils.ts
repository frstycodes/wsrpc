export function safeJsonParse<T = unknown>(
  raw: string | Buffer | ArrayBuffer
): T | undefined {
  let text: string
  if (typeof raw === 'string') text = raw

  if (raw instanceof ArrayBuffer) {
    text = new TextDecoder().decode(raw)
  } else {
    text = raw.toString()
  }

  try {
    return JSON.parse(text) as T
  } catch {
    return
  }
}
