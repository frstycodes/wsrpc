# @frsty/wsrpc

Type-safe RPC and event streaming over WebSockets. Define procedures on the server, get fully-typed `send` and `on` on the client — no codegen, no schema duplication.

## Install

```bash
npm install @frsty/wsrpc
```

Supports any schema library that implements [Standard Schema](https://standardschema.dev) (zod, valibot, arktype, etc.).

## Quick start

### Server

```ts
import { z } from 'zod'
import { createProcedure, WebsocketHandler } from '@frsty/wsrpc/server'

type Ctx = { userId: string; room: string }

const base = createProcedure<Ctx>()

const router = {
  // Pure RPC — yield events, then return a value
  sendMessage: base
    .input(z.object({ text: z.string() }))
    .handler(function* (c) {
      yield c.replyAll('message', { text: c.input.text, from: c.userId })
      yield c.reply('ack', { delivered: true })
      return { ok: true }
    }),
}

export const handler = new WebsocketHandler(router, {
  *onOpen({ ctx }) {
    yield ctx.replyAll('presence', { userId: ctx.userId, status: 'online' })
  },
  *onClose({ ctx }) {
    yield ctx.replyAll('presence', { userId: ctx.userId, status: 'offline' })
  },
})

export type AppHandler = typeof handler
```

### Bun adapter

```ts
import { handler } from './router'

type WsData = { userId: string; room: string; conn: unknown }

const server = Bun.serve<WsData>({
# @frsty/wsrpc

Type-safe RPC and event streaming over WebSockets. Define procedures on the server, get fully-typed `send` and `on` on the client — no codegen, no schema duplication.

## Install

```bash
npm install @frsty/wsrpc
```

Supports any schema library that implements [Standard Schema](https://standardschema.dev) (zod, valibot, arktype, etc.).

## Quick start

### Server

```ts
import { z } from 'zod'
import { createProcedure, WebsocketHandler } from '@frsty/wsrpc/server'

type Ctx = { userId: string; room: string }

const base = createProcedure<Ctx>()

const router = {
  // Pure RPC — yield events, then return a value
  sendMessage: base
    .input(z.object({ text: z.string() }))
    .handler(function* (c) {
      yield c.replyAll('message', { text: c.input.text, from: c.userId })
      yield c.reply('ack', { delivered: true })
      return { ok: true }
    }),
}

export const handler = new WebsocketHandler(router, {
  *onOpen({ ctx }) {
    yield ctx.replyAll('presence', { userId: ctx.userId, status: 'online' })
  },
  *onClose({ ctx }) {
    yield ctx.replyAll('presence', { userId: ctx.userId, status: 'offline' })
  },
})

export type AppHandler = typeof handler
```

### Bun adapter

```ts
import { handler } from './router'

type WsData = { userId: string; room: string; conn: unknown }

const server = Bun.serve<WsData>({
  port: 3000,

  fetch(req, srv) {
    const url = new URL(req.url)
    srv.upgrade(req, {
      data: {
        userId: url.searchParams.get('userId') ?? 'anon',
        room: url.searchParams.get('room') ?? 'lobby',
        conn: null,
      },
    })
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
    message(ws, raw) { ws.data.conn.handleMessage(raw) },
    close(ws) {
      ws.data.conn.handleClose()
      ws.unsubscribe(`room:${ws.data.room}`)
    },
  },
})
```

### Client

```ts
import { createClient } from '@frsty/wsrpc/client'
import type { AppHandler } from './router'

const client = createClient<AppHandler>('ws://localhost:3000?userId=alice&room=lobby', {
  reconnect: true,
})

// Typed event listeners
client.on('presence', (data) => console.log(data.userId, data.status))
client.on('message', (data) => console.log(data.from, data.text))

// Typed RPC calls
const result = await client.send('sendMessage', { text: 'hello' })
// result: { ok: true }
```

## Concepts

### Procedures

Handlers are generator functions. `yield` emits events to connected clients, `return` sends the RPC response back to the caller.

```ts
.handler(function* (c) {
  yield c.reply('progress', { pct: 50 })        // → only the caller
  yield c.replyAll('announcement', { msg: '…' }) // → everyone (via broadcast)
  return { done: true }                           // → RPC response to caller
})
```

### Input validation

Pass any Standard Schema-compatible validator to `.input()`:

```ts
import { z } from 'zod'
import * as v from 'valibot'
import { type } from 'arktype'

base.input(z.object({ text: z.string() }))
base.input(v.object({ text: v.string() }))
base.input(type({ text: 'string' }))
```

### Lifecycle hooks

`onOpen`, `onClose`, and `onError` are generator functions on `WebsocketHandler`. They receive the typed `ctx` and can yield events the same way procedures do.

### Context

`ctx` is the typed object your adapter passes into `handler.connection()`. It's merged with `reply` and `replyAll` before being handed to each handler.

```ts
type Ctx = { userId: string; role: 'admin' | 'user' }

const base = createProcedure<Ctx>()

base.handler(function* (c) {
  if (c.role === 'admin') yield c.replyAll('notice', { msg: 'admin here' })
  return { ok: true }
})
```

## API

### `@frsty/wsrpc/server`

| Export | Description |
|---|---|
| `createProcedure<Ctx>()` | Creates a procedure builder bound to a context type |
| `WebsocketHandler` | Wraps a router and lifecycle hooks, exposes `.connection()` |
| `ConnectionOpts` | Type for the argument to `.connection()` — wire your framework here |
| `Router`, `Lifecycle`, `HandlerCtx` | Supporting types |

### `@frsty/wsrpc/client`

| Export | Description |
|---|---|
| `createClient<Handler>(url, opts)` | Creates a typed client |
| `ClientOptions` | Reconnect, lifecycle callbacks |

### `@frsty/wsrpc/server/internal`

Low-level types for building framework adapters: `ConnectionOpts`, `Router`, `LifecycleFn`, `AllGenerator`, `safeJsonParse`.

### `@frsty/wsrpc/client/internal`

Low-level types for building custom transports: `InferHandler`, `InferRouterTypes`, `EventMap`, `AnyWebsocketHandler`, `safeJsonParse`.

## License

MIT
  port: 3000,

  fetch(req, srv) {
    const url = new URL(req.url)
    srv.upgrade(req, {
      data: {
        userId: url.searchParams.get('userId') ?? 'anon',
        room: url.searchParams.get('room') ?? 'lobby',
        conn: null,
      },
    })
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
    message(ws, raw) { ws.data.conn.handleMessage(raw) },
    close(ws) {
      ws.data.conn.handleClose()
      ws.unsubscribe(`room:${ws.data.room}`)
    },
  },
})
```

### Client

```ts
import { createClient } from '@frsty/wsrpc/client'
import type { AppHandler } from './router'

const client = createClient<AppHandler>('ws://localhost:3000?userId=alice&room=lobby', {
  reconnect: true,
})

// Typed event listeners
client.on('presence', (data) => console.log(data.userId, data.status))
client.on('message', (data) => console.log(data.from, data.text))

// Typed RPC calls
const result = await client.send('sendMessage', { text: 'hello' })
// result: { ok: true }
```

## Concepts

### Procedures

Handlers are generator functions. `yield` emits events to connected clients, `return` sends the RPC response back to the caller.

```ts
.handler(function* (c) {
  yield c.reply('progress', { pct: 50 })        // → only the caller
  yield c.replyAll('announcement', { msg: '…' }) // → everyone (via broadcast)
  return { done: true }                           // → RPC response to caller
})
```

### Input validation

Pass any Standard Schema-compatible validator to `.input()`:

```ts
import { z } from 'zod'
import * as v from 'valibot'
import { type } from 'arktype'

base.input(z.object({ text: z.string() }))
base.input(v.object({ text: v.string() }))
base.input(type({ text: 'string' }))
```

### Lifecycle hooks

`onOpen`, `onClose`, and `onError` are generator functions on `WebsocketHandler`. They receive the typed `ctx` and can yield events the same way procedures do.

### Context

`ctx` is the typed object your adapter passes into `handler.connection()`. It's merged with `reply` and `replyAll` before being handed to each handler.

```ts
type Ctx = { userId: string; role: 'admin' | 'user' }

const base = createProcedure<Ctx>()

base.handler(function* (c) {
  if (c.role === 'admin') yield c.replyAll('notice', { msg: 'admin here' })
  return { ok: true }
})
```

## API

### `@frsty/wsrpc/server`

| Export | Description |
|---|---|
| `createProcedure<Ctx>()` | Creates a procedure builder bound to a context type |
| `WebsocketHandler` | Wraps a router and lifecycle hooks, exposes `.connection()` |
| `ConnectionOpts` | Type for the argument to `.connection()` — wire your framework here |
| `Router`, `Lifecycle`, `HandlerCtx` | Supporting types |

### `@frsty/wsrpc/client`

| Export | Description |
|---|---|
| `createClient<Handler>(url, opts)` | Creates a typed client |
| `ClientOptions` | Reconnect, lifecycle callbacks |

### `@frsty/wsrpc/server/internal`

Low-level types for building framework adapters: `ConnectionOpts`, `Router`, `LifecycleFn`, `AllGenerator`, `safeJsonParse`.

### `@frsty/wsrpc/client/internal`

Low-level types for building custom transports: `InferHandler`, `InferRouterTypes`, `EventMap`, `AnyWebsocketHandler`, `safeJsonParse`.

## License

MIT
