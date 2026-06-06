import { createClient } from '../src/client'
import type { AppHandler } from './server'

// ── Connect ───────────────────────────────────────────────────────────────────

const client = createClient<AppHandler>(
  'ws://localhost:3000?userId=alice&room=lobby',
  {
    reconnect: true,
    onOpen: () => console.log('[ws] connected'),
    onClose: () => console.log('[ws] disconnected'),
  }
)

// ── Event listeners ───────────────────────────────────────────────────────────

client.on('presence', (data) => {
  console.log(`[presence] ${data.userId} is ${data.status} in ${data.room}`)
})

client.on('message', (data) => {
  console.log(`[message] ${data.from}: ${data.text}`)
})

client.on('ack', (data) => {
  console.log(`[ack] delivered=${data.delivered}`)
})

// ── RPC calls ─────────────────────────────────────────────────────────────────

// Give the socket a tick to open before sending
await Bun.sleep(100)

const pong = await client.send('ping', { message: 'hello' })
console.log('[ping]', pong)

const time = await client.send('getTime', undefined)
console.log('[time]', new Date(time.ts).toISOString())

const result = await client.send('sendMessage', { text: 'hey everyone!' })
console.log('[sendMessage]', result)

// ── Clean up ──────────────────────────────────────────────────────────────────

await Bun.sleep(100)
client.close()
