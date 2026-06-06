import { z } from 'zod'
import { createProcedure, WebsocketHandler } from '../src/server'

// Context

export type Ctx = {
  userId: string
  room: string
}

// Procedures
const base = createProcedure<Ctx>()

export const router = {
  // biome-ignore lint/correctness/useYield: no events to emit
  ping: base.input(z.object({ message: z.string() })).handler(function* (c) {
    return { pong: c.input.message, from: c.userId }
  }),

  sendMessage: base
    .input(z.object({ text: z.string() }))
    .handler(function* (c) {
      // Broadcast to everyone connected
      yield c.replyAll('message', {
        text: c.input.text,
        from: c.userId,
        room: c.room,
      })
      // Confirm delivery to sender only
      yield c.reply('ack', { delivered: true })
      return { ok: true }
    }),

  // biome-ignore lint/correctness/useYield: no events to emit
  getTime: base.handler(function* () {
    return { ts: Date.now() }
  }),
}

export const handler = new WebsocketHandler(router, {
  *onOpen({ ctx }) {
    yield ctx.replyAll('presence', {
      userId: ctx.userId,
      room: ctx.room,
      status: 'online',
    })
  },

  *onClose({ ctx }) {
    yield ctx.replyAll('presence', {
      userId: ctx.userId,
      room: ctx.room,
      status: 'offline',
    })
  },
})

export type AppRouter = typeof router
export type AppHandler = typeof handler

// ── Bun server ────────────────────────────────────────────────────────────────

type WsData = {
  userId: string
  room: string
  // biome-ignore lint/suspicious/noExplicitAny: conn shape unknown at type level
  conn: any
}

const server = Bun.serve<WsData>({
  port: 8080,
  fetch(req, srv) {
    const url = new URL(req.url)
    const userId = url.searchParams.get('userId') ?? 'anon'
    const room = url.searchParams.get('room') ?? 'lobby'

    const upgraded = srv.upgrade(req, { data: { userId, room, conn: null } })
    if (upgraded) return

    return new Response('socket-rpc server', { status: 200 })
  },

  websocket: {
    open(ws) {
      ws.subscribe(`room:${ws.data.room}`)

      ws.data.conn = handler.connection({
        ctx: { userId: ws.data.userId, room: ws.data.room },
        send: (data) => ws.send(data),
        broadcast: (data) => server.publish(`room:${ws.data.room}`, data),
      })

      ws.data.conn.handleOpen()
    },

    message(ws, raw) {
      ws.data.conn.handleMessage(raw)
    },

    close(ws) {
      ws.data.conn.handleClose()
      ws.unsubscribe(`room:${ws.data.room}`)
    },
  },
})

console.log(`Listening on ws://localhost:${server.port}`)
