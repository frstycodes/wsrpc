import type { InferHandler } from '@/core'
import type { AnyWebsocketHandler } from '@/core/types'
import { safeJsonParse } from '@/utils'

// Options
export type ClientOptions = {
  /** Called when the connection is established */
  onOpen?: () => void
  /** Called when the connection closes */
  onClose?: (event: CloseEvent) => void
  /** Called on connection errors */
  onError?: (event: Event) => void
  /** Reconnect on close. Default: false */
  reconnect?: boolean | ((retries: number) => boolean)
  /** Base delay in ms between reconnect attempts. Default: 1000 */
  reconnectDelay?: number
}

// Client
export function createClient<H extends AnyWebsocketHandler>(
  url: string,
  options: ClientOptions = {}
) {
  type App = InferHandler<H>
  type Routes = App['routes']
  type Events = App['events']

  const pending = new Map<
    string,
    { resolve: (d: unknown) => void; reject: (e: unknown) => void }
  >()

  // biome-ignore lint/suspicious/noExplicitAny: data can be any type
  const listeners = new Map<string, Set<(d: any) => void>>()

  let ws: WebSocket
  let reconnectAttempts = 0

  type Message = {
    type: string
    id?: string
    ok?: boolean
    result?: unknown
    error?: unknown
    code?: string
    data?: unknown
  }

  function handleMessage(raw: string) {
    const msg = safeJsonParse<Message>(raw)
    if (!msg) return

    if (msg.type === 'response' && msg.id) {
      const p = pending.get(msg.id)
      if (!p) return
      pending.delete(msg.id)
      if (msg.ok) return p.resolve(msg.result)
      return p.reject(msg.error)
    }

    if (msg.type === 'event' && msg.code) {
      for (const fn of listeners.get(msg.code) ?? []) fn(msg.data)
    }
  }

  function handleClose(event: CloseEvent) {
    options.onClose?.(event)
    if (!options.reconnect) return
    const shouldReconnect =
      typeof options.reconnect === 'function'
        ? options.reconnect(reconnectAttempts)
        : options.reconnect
    if (!shouldReconnect) return
    const delay = (options.reconnectDelay ?? 1000) * 2 ** reconnectAttempts
    reconnectAttempts++
    setTimeout(connect, Math.min(delay, 30_000))
  }

  function connect() {
    ws = new WebSocket(url)
    ws.onopen = () => {
      reconnectAttempts = 0
      options.onOpen?.()
    }
    ws.onclose = handleClose
    ws.onerror = (event) => options.onError?.(event)
    ws.onmessage = (e) => handleMessage(e.data)
  }

  connect()

  return {
    /** RPC-style — send and await a response */
    send<K extends keyof Routes>(
      code: K,
      data: Routes[K]['input']
    ): Promise<Routes[K]['output']> {
      const id = crypto.randomUUID()
      ws.send(JSON.stringify({ id, code, data }))

      return new Promise((resolve, reject) =>
        pending.set(id, { resolve, reject })
      )
    },

    /** Event listener — fired by server pushes from reply/replyAll */
    on<K extends keyof Events>(
      code: K,
      fn: (data: Events[K]) => void
    ): () => void {
      const c = code as string
      if (!listeners.has(c)) listeners.set(c, new Set())

      // biome-ignore lint/style/noNonNullAssertion: set was just created above
      listeners.get(c)!.add(fn)
      return () => listeners.get(c)?.delete(fn)
    },

    /** Close the connection (disables reconnect) */
    close() {
      options.reconnect = false
      ws.close()
    },

    get readyState() {
      return ws.readyState
    },
  }
}
