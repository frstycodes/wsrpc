import { safeJsonParse } from '@/utils'
import type { Emit } from './emit'
import type { AnyCtx, AnyProcedure, HandlerCtx } from './procedure'
import type { AllGenerator } from './types'

// ROUTER
export type Router = { [x: string]: AnyProcedure }

// LIFECYCLE
export type LifecycleFn<Ctx extends AnyCtx, Y extends Emit> = (args: {
  ctx: HandlerCtx<Ctx>
  error?: unknown
}) => AllGenerator<Y, void, unknown> | void | Promise<void>

// biome-ignore lint/complexity/noBannedTypes: ctx is empty by default
export type Lifecycle<Ctx extends AnyCtx = {}> = {
  onOpen?: LifecycleFn<Ctx, Emit>
  onClose?: LifecycleFn<Ctx, Emit>
  onError?: LifecycleFn<Ctx, Emit>
}

// CONNECTION OPTS
// biome-ignore lint/complexity/noBannedTypes: ctx is empty by default
export type ConnectionOpts<Ctx extends AnyCtx = {}> = {
  ctx: Ctx
  send: (data: string) => void
  broadcast: (data: string) => void
}

// MESSAGE FORMAT
type IncomingMessage = { id: string; code: string; data?: unknown }

// HANDLER CLASS
export class WebsocketHandler<
  R extends Router,
  L extends Lifecycle<Ctx>,
  Ctx extends AnyCtx = AnyCtx,
> {
  private readonly router: R
  private readonly lifecycle: L

  constructor(router: R, lifecycle: L = {} as L) {
    this.router = router
    this.lifecycle = lifecycle
  }

  connection(opts: ConnectionOpts<Ctx>) {
    const ctx: HandlerCtx<Ctx> = {
      ...opts.ctx,
      reply: (c, d) => ({ target: 'self', code: c, data: d }),
      replyAll: (c, d) => ({ target: 'all', code: c, data: d }),
    }

    return {
      handleOpen: () => drain(opts, this.lifecycle.onOpen?.({ ctx })),
      handleClose: () => drain(opts, this.lifecycle.onClose?.({ ctx })),
      handleError: (error: unknown) =>
        drain(opts, this.lifecycle.onError?.({ ctx, error })),

      handleMessage: async (raw: string | Buffer | ArrayBuffer) => {
        const parsed = safeJsonParse<IncomingMessage>(raw)
        if (!parsed) return

        const { id, data } = parsed

        const proc = this.router[parsed.code]
        if (!proc) return

        try {
          let validated: unknown

          if (proc._schema) {
            const res = await proc._schema['~standard'].validate(data ?? {})

            if ('issues' in res && res.issues) {
              opts.send(
                JSON.stringify({
                  id,
                  ok: false,
                  type: 'response',
                  error: res.issues,
                })
              )
              return
            }

            validated = res.value
          } else {
            validated = data
          }

          const result = await drain(
            opts,
            proc._handler({ input: validated as never, ...ctx })
          )
          opts.send(JSON.stringify({ type: 'response', id, ok: true, result }))
        } catch (err) {
          opts.send(
            JSON.stringify({
              type: 'response',
              id,
              ok: false,
              error: String(err),
            })
          )
        }
      },
    }
  }
}

function isGenerator(
  gen: unknown
): gen is AllGenerator<unknown, unknown, unknown> {
  return !!(
    gen &&
    typeof gen === 'object' &&
    'next' in gen &&
    typeof gen.next === 'function'
  )
}

async function drain(
  opts: ConnectionOpts,
  gen: AllGenerator<Emit, unknown, unknown> | void | Promise<void>
): Promise<unknown> {
  if (!isGenerator(gen)) return

  while (true) {
    const step = await gen.next()
    // Final return
    if (step.done) return step.value

    // Emit event `yield ctx.reply()` & `yield ctx.replyAll()`
    const payload = JSON.stringify({
      type: 'event',
      code: step.value.code,
      data: step.value.data,
    })

    if (step.value.target === 'all') {
      opts.broadcast(payload)
    } else {
      opts.send(payload)
    }
  }
}
